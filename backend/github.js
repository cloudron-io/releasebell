'use strict';

var assert = require('assert'),
    github = require('gh-got');

module.exports = exports = {
    verifyToken: verifyToken,
    getStarred: getStarred,
    getReleases: getReleases
};

function verifyToken(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    github('user/starred', { token: token }).then(function (result) {
        callback(null);
    }, function (error) {
        callback(error);
    });
}

function getStarred(token, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof callback, 'function');

    github('user/starred', { token: token }).then(function (result) {
        callback(null, result.body);
    }, function (error) {
        callback(error);
    });
}

function getReleases(token, project, callback) {
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    github(`repos/${project.name}/tags`, { token: token }).then(function (result) {
        callback(null, result.body);
    }, function (error) {
        callback(error);
    });
}