'use strict';

var assert = require('assert'),
    superagent = require('superagent');

module.exports = exports = {
    verifyToken,
    getStarred,
    getReleases,
    getReleaseBody,
    getCommit
};

function verifyToken(token) {
    assert.strictEqual(typeof token, 'string');

    throw new Error('not implemented');
}

function getStarred(token) {
    assert.strictEqual(typeof token, 'string');

    throw new Error('not implemented');
}

// Returns [{ projectId, version, createdAt, sha, body }]
function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    // we get tags instead of releases because some projects like GitLab itself only do releases for the main release (and not for patch)
    // https://docs.gitlab.com/ee/api/tags.html
    superagent.get(project.origin + '/api/v4/projects/' + encodeURIComponent(project.name) + '/repository/tags?order_by=updated&sort=desc').end(function (error, result) {
        if (error && error.status === 404) return callback(null, []);
        if (error) return callback(error);

        const releaseObjects = result.body.map(function (r) {
            const releaseObject = {
                projectId: project.id,
                version: r.name, createdAt:
                r.commit.created_at,
                sha: r.commit.id,
            };

            if (r.release) releaseObject.body = r.release.description; // tags may not have a "release"

            return releaseObject;
        });

        callback(null, releaseObjects);
    });
}

function getReleaseBody(token, project, version) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof version, 'string');

    return '';
}

// Returns { createdAt, message }
async function getCommit(token, project, sha) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof sha, 'string');

    const result = await superagent.get(`${project.origin}/api/v4/projects/${encodeURIComponent(project.name)}/repository/commits/${sha}`);

    return {
        createdAt: result.body.committed_date,
        message: result.body.message
    };
}
