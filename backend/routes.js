'use strict';

var assert = require('assert'),
    path = require('path'),
    fs = require('fs'),
    ldapjs = require('ldapjs'),
    database = require('./database.js'),
    github = require('./github.js'),
    tasks = require('./tasks.js'),
    lastMile = require('connect-lastmile'),
    HttpError = lastMile.HttpError,
    HttpSuccess = lastMile.HttpSuccess;

module.exports = exports = {
    status: status,
    auth: auth,

    profile: {
        get: profileGet,
        update: profileUpdate
    },

    projects: {
        get: projectsGet,
        add: projectAdd,
        list: projectsList,
        update: projectsUpdate,
        del: projectsDelete
    }
};

const LDAP_URL = process.env.CLOUDRON_LDAP_URL;
const LDAP_USERS_BASE_DN = process.env.CLOUDRON_LDAP_USERS_BASE_DN;
const LOCAL_AUTH_FILE = path.resolve('users.json');

var users = {};

var AUTH_METHOD = (LDAP_URL && LDAP_USERS_BASE_DN) ? 'ldap' : 'local';
if (AUTH_METHOD === 'ldap') {
    console.log('Use ldap auth');
} else {
    console.log(`Use local auth file ${LOCAL_AUTH_FILE}`);

    try {
        users = JSON.parse(fs.readFileSync(LOCAL_AUTH_FILE, 'utf8'));
    } catch (e) {
        let template = [{ username: 'username', email: 'test@example.com', password: 'password' }];
        console.log(`Unable to read local auth file. Create a JSON file at ${LOCAL_AUTH_FILE} with\n%s`, JSON.stringify(template, null, 4));

        process.exit(1);
    }
}

function status(req, res, next) {
    next(new HttpSuccess(200, {}));
}

function auth(req, res, next) {
    var credentials = req.query;

    if (!credentials.username || !credentials.password) return next(new HttpError(400, 'username and password required'));

    function returnOrCreateUser(user) {
        database.users.get(user.username, function (error, result) {
            if (error) {
                console.error(error);
                return next(new HttpError(500, error));
            }

            // user already exists
            if (result) {
                req.user = result;
                return next();
            }

            database.users.add({ id: user.username, email: user.email }, function (error, result) {
                if (error) return next(new HttpError(500, error));

                req.user = result;

                return next();
            });
        });
    }

    if (AUTH_METHOD === 'ldap') {
        var ldapClient = ldapjs.createClient({ url: process.env.CLOUDRON_LDAP_URL });
        ldapClient.on('error', function (error) {
            console.error('LDAP error', error);
        });

        ldapClient.bind(process.env.CLOUDRON_LDAP_BIND_DN, process.env.CLOUDRON_LDAP_BIND_PASSWORD, function (error) {
            if (error) return next(new HttpError(500, error));

            var filter = `(|(uid=${credentials.username})(mail=${credentials.username})(username=${credentials.username})(sAMAccountName=${credentials.username}))`;
            ldapClient.search(process.env.CLOUDRON_LDAP_USERS_BASE_DN, { filter: filter }, function (error, result) {
                if (error) return next(new HttpError(500, error));

                var items = [];

                result.on('searchEntry', function(entry) { items.push(entry.object); });
                result.on('error', function (error) { next(new HttpError(500, error)); });
                result.on('end', function (result) {
                    if (result.status !== 0) return next(new HttpError(500, error));
                    if (items.length === 0) return next(new HttpError(401, 'Invalid credentials'));

                    // pick the first found
                    var user = items[0];

                    ldapClient.bind(user.dn, credentials.password, function (error) {
                        if (error) return next(new HttpError(401, 'Invalid credentials'));

                        returnOrCreateUser({ username: user.username, email: user.mail });
                    });
                });
            });
        });
    } else {
        let user = users.find(function (u) { return (u.username === credentials.username || u.email === credentials.username) && u.password === credentials.password; });
        if (!user) return next(new HttpError(401, 'Invalid credentials'));

        returnOrCreateUser(user);
    }
}

function profileGet(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    next(new HttpSuccess(200, { user: req.user }));
}

function profileUpdate(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    github.verifyToken(req.body.githubToken, function (error) {
        if (error) return next(new HttpError(402, error.message));

        database.users.update(req.user.id, req.body, function (error) {
            if (error) return next(new HttpError(500, error));

            req.user.email = req.body.email;
            req.user.githubToken = req.body.githubToken;

            next(new HttpSuccess(202, {}));

            // kick off a round of syncing for the new github token
            tasks.run();
        });
    });
}

function projectsList(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    database.projects.list(req.user.id, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { projects: result }));
    });
}

function projectAdd(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    if (!req.body.type) return next(new HttpError(400, 'type is required'));
    if ([ database.PROJECT_TYPE_GITHUB, database.PROJECT_TYPE_GITLAB, database.PROJECT_TYPE_WEBSITE ].indexOf(req.body.type) === -1) return next(new HttpError(400, 'invalid type'));

    const project = {
        type: req.body.type,
        userId: req.user.id,
        name: req.body.name,
        origin: req.body.origin
    };

    database.projects.add(project, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(201, { project: result }));

        // force an initial release sync
        tasks.syncReleasesByProject(req.user, result, function (error) {
            if (error) console.error('Failed to perfom initial sync.', error);
        });
    });
}

function projectsGet(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');
    assert.strictEqual(typeof req.params.projectId, 'string');

    database.projects.get(req.user.id, req.params.projectId, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { project: result }));
    });
}

function projectsUpdate(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');
    assert.strictEqual(typeof req.params.projectId, 'string');

    database.projects.update(req.params.projectId, req.body, function (error) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(202, {}));
    });
}

function projectsDelete(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');
    assert.strictEqual(typeof req.params.projectId, 'string');

    database.projects.remove(req.params.projectId, function (error) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(202, {}));
    });
}
