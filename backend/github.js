'use strict';

var assert = require('assert'),
    async = require('async'),
    { Octokit } = require('@octokit/rest');

module.exports = exports = {
    verifyToken: verifyToken,
    getStarred: getStarred,
    getReleases: getReleases,
    getCommit: getCommit
};

// translate some api errors
function handleError(callback) {
    return function (error) {
        if (error) {
            if (error.status === 403 && error.message.indexOf('API rate limit exceeded') === 0) {
                error.message = 'GitHub rate limit exceeded. Please wait a bit.';
            }
        }

        callback(error);
    };
}

function verifyToken(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    const octokit = new Octokit({ auth: token, userAgent: 'releasebell@cloudron' });

    octokit.users.getAuthenticated().then(function () {
        callback();
    }, handleError(callback));
}

function getStarred(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    const octokit = new Octokit({ auth: token, userAgent: 'releasebell@cloudron' });

    octokit.paginate(octokit.activity.listReposStarredByAuthenticatedUser).then(function (result) {
        callback(null, result);
    }, handleError(callback));
}

// Returns [{ projectId, version, createdAt, sha, body }]
function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    const octokit = new Octokit({ auth: token, userAgent: 'releasebell@cloudron' });

    const [ owner, repo ] = project.name.split('/');
    octokit.paginate(octokit.repos.listTags, { owner, repo }).then(function (result) { // tags have no created_at field
        let releases = [];

        async.eachLimit(result, 10, function (r, callback) {
            const releaseObj = {
                projectId: project.id,
                version: r.name,
                createdAt: null,
                sha: r.commit.sha
            };

            octokit.repos.getReleaseByTag({ owner, repo, tag: r.name }).then(function (release) {
                if (release.data.body) {
                    const fullBody = release.data.body.replace(/\r\n/g, '\n');
                    const releaseBody = fullBody.length > 1000 ? fullBody.substring(0, 1000) + '...' : fullBody;
                    releaseObj.body = releaseBody;
                }

                releases.push(releaseObj);

                callback(null);
            }, callback);
        }, function (error) {
            if (error) {
                console.error('Failed to get release tags.', error);
                return handleError(callback)(error);
            }

            callback(null, releases);
        });
    }, handleError(callback));
}

// Returns { createdAt, message }
function getCommit(token, project, commit_sha, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof commit_sha, 'string');
    assert.strictEqual(typeof callback, 'function');

    const octokit = new Octokit({ auth: token, userAgent: 'releasebell@cloudron' });

    const [ owner, repo ] = project.name.split('/');
    octokit.git.getCommit({ owner, repo, commit_sha }).then(function (result) {
        callback(null, { createdAt: result.data.committer.date, message: result.data.message });
    }, callback);
}
