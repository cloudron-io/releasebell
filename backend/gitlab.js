'use strict';

var assert = require('assert'),
    superagent = require('superagent');

module.exports = exports = {
    verifyToken: verifyToken,
    getStarred: getStarred,
    getReleases: getReleases,
    getCommit: getCommit
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
