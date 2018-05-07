'use strict';

var assert = require('assert'),
    GitHub = require('github-api');

module.exports = exports = {
    verifyToken: verifyToken,
    getStarred: getStarred,
    getReleases: getReleases
};

function verifyToken(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    var api = new GitHub({ token: token });
    var user = api.getUser();

    user.listStarredRepos(function (error, result) {
        if (error) return callback(error);
        callback();
    });
}

function getStarred(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    var api = new GitHub({ token: token });
    var user = api.getUser();

    user.listStarredRepos(function (error, result) {
        if (error) return callback(error);
        callback(null, result);
    });
}

function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    var api = new GitHub({ token: token });
    var repo = api.getRepo(project.name);

    repo.listTags(function (error, result) {
        if (error) return callback(error);
        callback(null, result);
    });
}