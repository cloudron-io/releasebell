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

function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    // https://gitlab.example.com/api/v4/projects/24/releases

    console.log('---', token, project)

    callback(null, []);
}

function getCommit(token, project, sha, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof sha, 'string');
    assert.strictEqual(typeof callback, 'function');

    callback(new Error('not implemented'));
}
