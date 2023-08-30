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
            onSecondaryRateLimit: (retryAfter, options) => {
                // does not retry, only logs a warning
                console.log(`SecondaryRateLimit detected for request ${options.method} ${options.url}`);
            }
        },
        retry: {
            doNotRetry: ['429'],
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

function rethrow(error) {
    if (error.status === 403 && error.message.indexOf('API rate limit exceeded') === 0) {
        error.message = 'GitHub rate limit exceeded. Please wait a bit.';
        error.retryAt = error.response.headers['x-ratelimit-reset'] ? parseInt(error.response.headers['x-ratelimit-reset'])*1000 : 0;
    }

    throw error;
}

async function verifyToken(token) {
    assert.strictEqual(typeof token, 'string');

    if (!token) return;

    const octokit = buildOctokit(token);

    try {
        await octokit.users.getAuthenticated();
    } catch (error) {
        rethrow(error);
    }
}

async function getStarred(token) {
    assert.strictEqual(typeof token, 'string');

    const octokit = buildOctokit(token);

    let result;
    try {
        result = await octokit.paginate(octokit.activity.listReposStarredByAuthenticatedUser);
    } catch (error) {
        rethrow(error);
    }

    return result;
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
function getCommit(token, project, commit_sha) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof commit_sha, 'string');

    const octokit = buildOctokit(token);

    const [ owner, repo ] = project.name.split('/');

    let result;
    try {
        result = octokit.git.getCommit({ owner, repo, commit_sha });
    } catch (error) {
        rethrow(error);
    }

    return {
        createdAt:
        result.data.committer.date,
        message: result.data.message
    };
}
