'use strict';

var assert = require('assert'),
    path = require('path'),
    fs = require('fs'),
    basicAuth = require('basic-auth'),
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
        list: projectsList,
        get: projectsGet,
        update: projectsUpdate
    },

    releases: {
        list: releasesList,
        get: releasesGet
    }
};

const LDAP_URL = process.env.LDAP_URL;
const LDAP_USERS_BASE_DN = process.env.LDAP_USERS_BASE_DN;
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
    var credentials = basicAuth(req);

    if (!credentials) return next(new HttpError(400, 'Basic auth required'));

    if (AUTH_METHOD === 'ldap') {
        // TODO
    } else {
        let user = users.find(function (u) { return (u.username === credentials.name || u.email === credentials.name) && u.password === credentials.pass; });
        if (!user) return next(new HttpError(401, 'Invalid credentials'));

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
}

function profileGet(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    next(new HttpSuccess(200, { user: req.user }));
}

function profileUpdate(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    github.verifyToken(req.body.githubToken, function (error) {
        if (error) return next(new HttpError(402, error));

        database.users.update(req.user.id, req.body, function (error) {
            if (error) return next(new HttpError(500, error));

            req.user.email = req.body.email;
            req.user.githubToken = req.body.githubToken;

            next(new HttpSuccess(202, {}));

            // trigger a sync for the user
            tasks.syncStarredByUser(req.user, function (error) {
                if (error) console.error(error);

                tasks.syncReleasesByUser(req.user, function (error) {
                    if (error) console.error(error);
                });
            });
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

    database.projects.update(req.params.projectId, req.body.project, function (error) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(202, {}));
    });
}

function releasesList(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    database.releases.list(req.user.id, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { releases: result }));
    });
}

function releasesGet(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');
    assert.strictEqual(typeof req.params.projectId, 'string');
    assert.strictEqual(typeof req.params.releaseId, 'string');

    database.releases.get(req.params.releaseId, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { release: result }));
    });
}
