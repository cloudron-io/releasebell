'use strict';

var assert = require('assert'),
    uuid = require('uuid/v1'),
    fs = require('fs');

const USER_SCHEMA = {
    id: 'string',
    email: 'string',
    githubToken: 'string'
};

const REPO_SCHEMA = {
    id: 'string',
    name: 'string',
    type: 'REPO_TYPE_*',    // only github for now
    enabled: 'boolean',
    identifier: 'string'
};

module.exports = exports = {
    init: init,

    REPO_TYPE_GITHUB: 'github',

    repo: {
        getAll: repoGetAll,
        add: repoAdd,
        get: repoGet,
        update: repoUpdate,
        remove: repoRemove
    },

    user: {
        getAll: userGetAll,
        add: userAdd,
        get: userGet,
        update: userUpdate,
        remove: userRemove
    }
};

const DB_FILEPATH = 'db.json';
var db = {};

function init(callback) {
    assert.strictEqual(typeof callback, 'function');

    fs.readFile(DB_FILEPATH, 'utf8', function (error, result) {
        if (error && error.code !== 'ENOENT') return callback(error);

        if (error) {
            db = {};
        } else {
            try {
                db = JSON.parse(result);
            } catch (e) {
                return callback(e);
            }
        }

        // ensure basic objects
        if (!db.user) db.user = {};
        if (!db.repo) db.repo = {};

        if (Object.keys(db.user).length === 0) {
            db.user['0000'] = {
                id: '0000',
                email: 'johannes@nebulon.de'
            };
        }

        callback();
    });
}

function save() {
    try {
        fs.writeFileSync(DB_FILEPATH, JSON.stringify(db), 'utf8');
    } catch (e) {
        console.error('Unable to save db.', e);
    }
}

function repoGetAll(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    if (!db.user[userId]) return callback(null, []);
    if (!db.user[userId].repos) return callback(null, []);

    callback(null, Object.keys(db.user[userId].repos).map(function (k) { return db.user[userId].repos[k]; }));
}

function repoAdd(userId, repo, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof repo, 'object');
    assert.strictEqual(typeof callback, 'function');

    if (!db.user[userId]) return callback('no such user');
    if (!db.user[userId].repos) db.user[userId].repos = {};

    repo.id = uuid();
    db.user[userId].repos[repo.id] = repo;
    save();

    callback(null, repo);
}

function repoGet(userId, repoId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof repoId, 'string');
    assert.strictEqual(typeof callback, 'function');

    if (!db.user[userId]) return callback('no such user');
    if (!db.user[userId].repos) return callback(null, null);
    if (!db.user[userId].repos[repoId]) return callback(null, null);

    callback(null, db.user[userId].repos[repoId]);
}

function repoUpdate(userId, repoId, data, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof repoId, 'string');
    assert.strictEqual(typeof data, 'object');
    assert.strictEqual(typeof callback, 'function');

    if (!db.user[userId]) return callback('no such user');
    if (!db.user[userId].repos) return callback('no such repo');
    if (!db.user[userId].repos[repoId]) return callback('no such repo');

    Object.keys(data).forEach(function (k) { db.user[userId].repos[repoId][k] = data[k]; });
    save();

    callback();
}

function repoRemove(userId, repoId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof repoId, 'string');
    assert.strictEqual(typeof callback, 'function');

    if (!db.user[userId]) return callback('no such user');
    if (!db.user[userId].repos) return callback();
    if (!db.user[userId].repos[repoId]) return callback();

    delete db.user[userId].repos[repoId];
    save();

    callback();
}

function userGetAll(callback) {
    assert.strictEqual(typeof callback, 'function');

    callback(null, Object.keys(db.user).map(function (k) { return db.user[k]; }));
}

function userAdd(user, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof callback, 'function');

    user.id = uuid();
    db.user[user.id] = user;
    save();

    callback(null, user);
}

function userGet(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    if (!db.user[userId]) return callback(null, null);

    callback(null, db.user[userId]);
}

function userUpdate(userId, data, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof data, 'object');
    assert.strictEqual(typeof callback, 'function');

    if (!db.user[userId]) return callback(null, null);

    // prevent loss of repo information
    delete data.repos;

    Object.keys(data).forEach(function (k) { db.user[userId][k] = data[k]; });
    save();

    callback();
}

function userRemove(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    if (db.user[userId]) delete db.user[userId];
    save();

    callback();
}
