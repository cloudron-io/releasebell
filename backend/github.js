'use strict';

var assert = require('assert'),
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
    octokit.paginate(octokit.repos.listTags, { owner, repo }).then(async function (result) { // tags have no created_at field
        const releases = await Promise.all(result.map(function(r) {
            const releaseObj = {
                projectId: project.id,
                version: r.name,
                createdAt: null,
                sha: r.commit.sha
            };

            return octokit.repos.getReleaseByTag({ owner, repo, tag: r.name }).then(function (release) {
                if (release.data.body) {
                    console.log(`release body ${release.data.body}`)
                    const fullBody = release.data.body.replace(/\r\n/g, "\n");
                    const releaseBody = fullBody.length > 1000 ? fullBody.substring(0, 1000) + "..." : fullBody;
                    releaseObj.body = releaseBody;
                }

                return releaseObj;
            }, function(error) {
                // If we're here, something may have gone wrong with the API call
                return releaseObj;
            });
        }));

        callback(null, releases);
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
