'use strict';

var assert = require('assert'),
    { Octokit } = require('@octokit/rest'),
    { retry } = require('@octokit/plugin-retry'),
    { throttling } = require('@octokit/plugin-throttling');

module.exports = exports = {
    verifyToken,
    getStarred,
    getReleases,
    getReleaseBody,
    getCommit
};

function buildOctokit(token) {
    const CustomOctokit = Octokit.plugin(retry, throttling);
    const octokit = new CustomOctokit({
        auth: token,
        userAgent: 'releasebell@cloudron',
        throttle: {
            onRateLimit: (retryAfter, options) => {
                console.log(`Request quota exhausted for request ${options.method} ${options.url}`);
                console.log(`Already retried ${options.request.retryCount} times. Retrying again after ${retryAfter} seconds!`);
                return true;
            },
            onAbuseLimit: (retryAfter, options) => {
              // does not retry, only logs a warning
              console.log(`Abuse detected for request ${options.method} ${options.url}`);
            },
        },
        retry: {
            doNotRetry: ["429"],
        },
    });

    return octokit;
}

// translate some api errors
function handleError(callback) {
    return function (error) {
        if (error) {
            if (error.status === 403 && error.message.indexOf('API rate limit exceeded') === 0) {
                error.message = 'GitHub rate limit exceeded. Please wait a bit.';
                error.retryAt = error.response.headers['x-ratelimit-reset'] ? parseInt(error.response.headers['x-ratelimit-reset'])*1000 : 0;
            }
        }

        callback(error);
    };
}

function verifyToken(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    if (!token) return callback(null);

    const octokit = buildOctokit(token);

    octokit.users.getAuthenticated().then(function () {
        callback();
    }, handleError(callback));
}

function getStarred(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    const octokit = buildOctokit(token);

    octokit.paginate(octokit.activity.listReposStarredByAuthenticatedUser).then(function (result) {
        callback(null, result);
    }, handleError(callback));
}

// Returns [{ projectId, version, createdAt, sha, body }]
function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    const octokit = buildOctokit(token);

    const [ owner, repo ] = project.name.split('/');
    octokit.paginate(octokit.repos.listTags, { owner, repo, per_page: 100 }).then(function (result) { // tags have no created_at field
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

    const octokit = buildOctokit(token);
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

    const octokit = buildOctokit(token);

    const [ owner, repo ] = project.name.split('/');
    octokit.git.getCommit({ owner, repo, commit_sha }).then(function (result) {
        callback(null, { createdAt: result.data.committer.date, message: result.data.message });
    }, handleError(callback));
}
