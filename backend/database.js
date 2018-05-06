'use strict';

var assert = require('assert'),
    uuid = require('uuid/v4'),
    mysql = require('mysql');

module.exports = exports = {
    init: init,

    users: {
        list: usersList,
        add: usersAdd,
        get: usersGet,
        update: usersUpdate,
        remove: usersRemove
    },

    projects: {
        list: projectsList,
        add: projectsAdd,
        get: projectsGet,
        update: projectsUpdate,
        remove: projectsRemove,
        removeAll: projectsRemoveAll
    },

    releases: {
        list: releasesList,
        listAllPending: releasesListAllPending,
        add: releasesAdd,
        get: releasesGet,
        update: releasesUpdate
    }
};

var db = null;

function init(callback) {
    assert.strictEqual(typeof callback, 'function');

    var config = require('../database.json');
    if (!config.defaultEnv) {
        console.error('defaultEnv missing from database.json');
        process.exit(1);
    }

    db = mysql.createPool({
        connectionLimit: 10,
        host: config[config.defaultEnv].host,
        port: config[config.defaultEnv].port,
        user: config[config.defaultEnv].user,
        password: config[config.defaultEnv].password,
        database: config[config.defaultEnv].database
    });

    callback();
}

function projectsList(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    db.query('SELECT * FROM projects WHERE userId=?', [ userId ], function (error, result) {
        if (error) return callback(error);
        callback(null, result);
    });
}

function projectsAdd(project, callback) {
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    project.id = uuid();

    db.query('INSERT INTO projects SET ?', project, function (error) {
        if (error) return callback(error);
        callback(null, project);
    });
}

function projectsGet(projectId, callback) {
    assert.strictEqual(typeof projectId, 'string');
    assert.strictEqual(typeof callback, 'function');

    db.query('SELECT * FROM projects WHERE id=?', [ projectId ], function (error, result) {
        if (error) return callback(error);
        callback(null, result[0]);
    });
}

// we only allow updating the enabled flag for now
function projectsUpdate(projectId, data, callback) {
    assert.strictEqual(typeof projectId, 'string');
    assert.strictEqual(typeof data, 'object');
    assert.strictEqual(typeof callback, 'function');

    db.query('UPDATE projects SET enabled=? WHERE id=?', [ data.enabled, projectId ], function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function projectsRemove(projectId, callback) {
    assert.strictEqual(typeof projectId, 'string');
    assert.strictEqual(typeof callback, 'function');

    db.query('DELETE FROM releases WHERE projectId=?', [ projectId ], function (error) {
        if (error) return callback(error);

        db.query('DELETE FROM projects WHERE id=?', [ projectId ], function (error) {
            if (error) return callback(error);

            callback();
        });
    });
}

function projectsRemoveAll(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    db.query('DELETE FROM projects WHERE userId=?', [ userId ], function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function usersList(callback) {
    assert.strictEqual(typeof callback, 'function');

    db.query('SELECT * FROM users', [], function (error, result) {
        if (error) return callback(error);
        callback(null, result);
    });
}

function usersAdd(user, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof callback, 'function');

    db.query('INSERT INTO users SET ?', user, function (error) {
        if (error) return callback(error);
        callback(null, user);
    });
}

function usersGet(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    db.query('SELECT * FROM users WHERE id=?', [ userId ], function (error, result) {
        if (error) return callback(error);
        callback(null, result[0]);
    });
}

function usersUpdate(userId, data, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof data, 'object');
    assert.strictEqual(typeof callback, 'function');

    db.query('UPDATE users SET email=?, githubToken=? WHERE id=?', [ data.email, data.githubToken, userId ], function (error, result) {
        if (error) return callback(error);
        callback(null);
    });
}

function usersRemove(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    callback();
}

function releasesList(projectId, callback) {
    assert.strictEqual(typeof projectId, 'string');
    assert.strictEqual(typeof callback, 'function');

    db.query('SELECT * FROM releases WHERE projectId=?', [ projectId ], function (error, result) {
        if (error) return callback(error);
        callback(null, result);
    });
}

function releasesAdd(release, callback) {
    assert.strictEqual(typeof release, 'object');
    assert.strictEqual(typeof callback, 'function');

    release.id = uuid();

    db.query('INSERT INTO releases SET ?', release, function (error) {
        if (error) return callback(error);
        callback(null, release);
    });
}

function releasesGet(releaseId, callback) {
    assert.strictEqual(typeof projectId, 'string');
    assert.strictEqual(typeof callback, 'function');

    db.query('SELECT * FROM releases WHERE releaseId=?', [ releaseId ], function (error, result) {
        if (error) return callback(error);
        callback(null, result[0]);
    });
}

// we only allow updating the notfied flag for now
function releasesUpdate(releaseId, data, callback) {
    assert.strictEqual(typeof releaseId, 'string');
    assert.strictEqual(typeof data, 'object');
    assert.strictEqual(typeof callback, 'function');

    db.query('UPDATE releases SET notified=? WHERE id=?', [ data.notified, releaseId ], function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function releasesListAllPending(callback) {
    assert.strictEqual(typeof callback, 'function');

    db.query('SELECT * FROM releases WHERE notified=FALSE', [], function (error, result) {
        if (error) return callback(error);
        callback(null, result);
    });
}
