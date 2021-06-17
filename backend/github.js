'use strict';

var assert = require('assert'),
    { Octokit } = require('@octokit/rest');

module.exports = exports = {
    verifyToken,
    getStarred,
    getReleases,
    getReleaseBody,
    getCommit
};

// translate some api errors
function handleError(callback) {
    return function (error) {
        if (error) {
            if (error.status === 403 && error.message.indexOf('API rate limit exceeded') === 0) {
                error.message = 'GitHub rate limit exceeded. Please wait a bit.';
                error.retryAt = error.headers['x-ratelimit-reset'] ? parseInt(error.headers['x-ratelimit-reset'])*1000 : 0;
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
        const releases = result.map(function (r) {
            return {
                projectId: project.id,
                version: r.name,
                createdAt: null,
                sha: r.commit.sha,
                body: '' // will be filled later to avoid fetchin all releases all the time
            };
        });

        callback(null, releases);
    }, handleError(callback));
}

function getReleaseBody(token, project, version, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof version, 'string');
    assert.strictEqual(typeof callback, 'function');

    const octokit = new Octokit({ auth: token, userAgent: 'releasebell@cloudron' });
    const [ owner, repo ] = project.name.split('/');

    octokit.repos.getReleaseByTag({ owner, repo, tag: version }).then(function (release) {
        if (!release.data.body) return callback(null, '');

        const fullBody = release.data.body.replace(/\r\n/g, '\n');

        callback(null, fullBody.length > 1000 ? fullBody.substring(0, 1000) + '...' : fullBody);

    }, function (error) {
        // no release tags is not an error
        if (error.status === 404) return callback(null, '');

        handleError(callback)(error);
    });
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
    }, handleError(callback));
}
