'use strict';

const assert = require('assert'),
    superagent = require('superagent');

module.exports = exports = {
    verifyToken,
    getStarred,
    getReleases,
    getCommit
};

function verifyToken(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    callback(new Error('not implemented'));
}

function getStarred(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    callback(new Error('not implemented'));
}

// Returns [{ projectId, version, createdAt, sha, body }]
function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    // we get tags instead of releases because some projects like GitLab itself only do releases for the main release (and not for patch)
    // https://docs.gitlab.com/ee/api/tags.html
    superagent.get(project.origin + '/api/v4/projects/' + encodeURIComponent(project.name) + '/repository/tags?order_by=updated&sort=desc').end(function (error, result) {
        if (error) return callback(error);

        const releaseObject = {
            projectId: project.id,
            version: result.body.name,
            createdAt: result.body.commit.created_at,
            sha: result.body.commit.id,
        };

        if (result.body.release && release.body.release.description) releaseObject.body = result.body.release.description;

        callback(null, releaseObject);
    });
}

// Returns { createdAt, message }
function getCommit(token, project, sha, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof sha, 'string');
    assert.strictEqual(typeof callback, 'function');

    superagent.get(project.origin + '/api/v4/projects/' + encodeURIComponent(project.name) + '/repository/commits/' + sha).end(function (error, result) {
        if (error) console.error(error);

        callback(null, { createdAt: result.body.committed_date, message: result.body.message });
    });
}
