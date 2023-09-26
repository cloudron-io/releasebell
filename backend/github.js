'use strict';

const assert = require('assert'),
    { Octokit } = require('@octokit/rest'),
    { retry } = require('@octokit/plugin-retry'),
    { throttling } = require('@octokit/plugin-throttling');

module.exports = exports = {
    verifyToken,
    getStarred,
    getReleases,
    getRelease,
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
async function getReleases(token, project) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');

    const octokit = buildOctokit(token);

    const [ owner, repo ] = project.name.split('/');

    let result;
    try {
        result = await octokit.paginate(octokit.repos.listTags, { owner, repo, per_page: 100 });
    } catch (error) {
        rethrow(error);
    }

    // tags have no created_at field
    const releases = result.map(function (r) {
        return {
            projectId: project.id,
            version: r.name,
            createdAt: null,
            sha: r.commit.sha,
            body: '' // will be filled later to avoid fetchin all releases all the time
        };
    });

    return releases;
}

async function getRelease(token, project, version) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof version, 'string');

    const octokit = buildOctokit(token);
    const [ owner, repo ] = project.name.split('/');

    let release;
    try {
        release = await octokit.repos.getReleaseByTag({ owner, repo, tag: version });
    } catch (error) {
        // no release tags is not an error
        if (error.status === 404) return '';

        rethrow(error);
    }

    if (!release.data.body) return { body: '', prerelease: false };

    let body = release.data.body.replace(/\r\n/g, '\n');
    return { body, prerelease: release.data.prerelease };
}

// Returns { createdAt, message }
async function getCommit(token, project, commit_sha) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof commit_sha, 'string');

    const octokit = buildOctokit(token);

    const [ owner, repo ] = project.name.split('/');

    let result;
    try {
        result = await octokit.git.getCommit({ owner, repo, commit_sha });
    } catch (error) {
        rethrow(error);
    }

    return {
        createdAt: result.data.committer.date,
        message: result.data.message
    };
}
