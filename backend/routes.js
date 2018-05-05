'use strict';

var assert = require('assert'),
    database = require('./database.js'),
    lastMile = require('connect-lastmile'),
    HttpError = lastMile.HttpError,
    HttpSuccess = lastMile.HttpSuccess;

module.exports = exports = {
    status: status,
    auth: auth,

    user: {
        get: userGet,
        update: userUpdate
    },

    repo: {
        add: repoAdd,
        get: repoGet,
        list: repoList,
        update: repoUpdate,
        remove: repoRemove
    }
};

function status(req, res, next) {
    next(new HttpSuccess(200, {}));
}

function auth(req, res, next) {
    database.user.getAll(function (error, results) {
        if (error) return next(new HttpError(500, error));

        req.user = results[0];

        next();
    });
}

function userGet(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    next(new HttpSuccess(200, { user: req.user }));
}

function userUpdate(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    next(new HttpError(500, 'not implemented'));
}

function repoAdd(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    if (typeof req.body.repo !== 'object') return next(new HttpError(400, 'missing repo object'));
    if (typeof req.body.repo.name !== 'string') return next(new HttpError(400, 'missing name string'));
    if (typeof req.body.repo.type !== 'string') return next(new HttpError(400, 'missing type string'));
    if (typeof req.body.repo.identifier !== 'string') return next(new HttpError(400, 'missing identifier string'));

    req.body.repo.enabled = true;

    database.repo.add(req.user.id, req.body.repo, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(201, { repo: result }));
    });
}

function repoGet(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    database.repo.get(req.user.id, req.params.repoId, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { repo: result }));
    });
}

function repoList(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    database.repo.get(req.user.id, function (error, result) {
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { repos: result }));
    });
}

function repoUpdate(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    next(new HttpError(500, 'not implemented'));
}

function repoRemove(req, res, next) {
    assert.strictEqual(typeof req.user, 'object');

    next(new HttpError(500, 'not implemented'));

}
