'use strict';

var assert = require('assert'),
    async = require('async'),
    GitHub = require('github-api');

module.exports = exports = {
    verifyToken: verifyToken,
    getStarred: getStarred,
    getReleases: getReleases
};

// translate some api errors
function handleError(callback) {
    return function (error) {
        if (error.response) {
            if (error.response.status === 403 && error.response.data.message.indexOf('API rate limit exceeded') === 0) {
                error.message = 'GitHub rate limit exceeded. Please wait a bit.';
            }
        }

        callback(error);
    };
}

function verifyToken(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    var api = new GitHub({ token: token });
    var user = api.getUser();

    user.listStarredRepos().then(function () {
        callback();
    }, handleError(callback));
}

function getStarred(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    var api = new GitHub({ token: token });
    var user = api.getUser();

    user.listStarredRepos().then(function (result) {
        callback(null, result.data);
    }, handleError(callback));
}

function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    var api = new GitHub({ token: token });
    var repo = api.getRepo(project.name);

    repo.listTags().then(function (result) {
        var releases = result.data;

        async.eachSeries(releases, function (release, callback) {
            repo.getCommit(release.commit.sha).then(function (result) {
                release.createdAt = new Date(result.data.committer.date);
                callback();
            }, callback);
        }, function (error) {
            if (error) return callback(error);
            callback(null, releases);
        });
    }, handleError(callback));
}