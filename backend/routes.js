'use strict';

var assert = require('assert'),
    database = require('./database.js'),
    github = require('./github.js'),
    tasks = require('./tasks.js'),
    lastMile = require('connect-lastmile'),
    HttpError = lastMile.HttpError,
    HttpSuccess = lastMile.HttpSuccess;

module.exports = exports = {
    status,
    auth,
    login,

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

const PORT = process.env.PORT || 3000;
const APP_ORIGIN = process.env.CLOUDRON_APP_ORIGIN || `http://localhost:${PORT}`;

function login(req, res) {
    res.oidc.login({
        returnTo: '/',
        authorizationParams: {
            redirect_uri: `${APP_ORIGIN}/api/v1/callback`,
        }
    });
}

function status(req, res, next) {
    next(new HttpSuccess(200, {}));
}

async function auth(req, res, next) {
    if (!req.oidc.isAuthenticated()) return next(new HttpError(401, 'Unauthorized'));

    let user;
    try {
        user = await database.users.get(req.oidc.user.sub);
    } catch (e) {
        try {
            user = await database.users.add({ id: req.oidc.user.sub, email: req.oidc.user.email, githubToken: '' });
        } catch (e) {
            console.error('Failed to add user', req.user.oidc.user, e);
            return next(new HttpError(500, 'internal error'));
        }
    }

    req.user = user;

    next();
}

function profileGet(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    next(new HttpSuccess(200, { user: req.user }));
}

function profileUpdate(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    const githubToken = req.body.githubToken || '';

    github.verifyToken(githubToken, function (error) {
        if (error) return next(new HttpError(402, error.message));

        database.users.update(req.user.id, { email: req.body.email, githubToken }, function (error) {
            if (error) return next(new HttpError(500, error));

            req.user.email = req.body.email;
            req.user.githubToken = githubToken;

            next(new HttpSuccess(202, {}));

            // kick off a round of syncing for the new github token
            if (githubToken) tasks.run();
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
    if ([ database.PROJECT_TYPE_GITHUB_MANUAL, database.PROJECT_TYPE_GITLAB, database.PROJECT_TYPE_WEBSITE ].indexOf(req.body.type) === -1) return next(new HttpError(400, 'invalid type'));

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
