'use strict';

const assert = require('assert'),
    uuid = require('uuid'),
    mysql = require('mysql2');

module.exports = exports = {
    init: init,

    PROJECT_TYPE_GITHUB: 'github',
    PROJECT_TYPE_GITHUB_MANUAL: 'github_manual',
    PROJECT_TYPE_GITLAB: 'gitlab',
    PROJECT_TYPE_WEBSITE: 'website',

    users: {
        list: usersList,
        add: usersAdd,
        get: usersGet,
        update: usersUpdate
    },

    projects: {
        list: projectsList,
        listByType: projectsListByType,
        add: projectsAdd,
        get: projectsGet,
        update: projectsUpdate,
        remove: projectsRemove
    },

    releases: {
        list: releasesList,
        listAllPending: releasesListAllPending,
        add: releasesAdd,
        update: releasesUpdate
    }
};

var db = null;

function init() {
    const config = require('../database.json');

    if (!config.defaultEnv) {
        console.error('defaultEnv missing from database.json');
        process.exit(1);
    }

    db = mysql.createPool({
        connectionLimit: 10,
        waitForConnections: true,
        host: config[config.defaultEnv].host,
        port: config[config.defaultEnv].port,
        user: config[config.defaultEnv].user,
        password: config[config.defaultEnv].password,
        database: config[config.defaultEnv].database
    }).promise();
}

function projectPostprocess(p) {
    if (p.lastSuccessfulSyncAt === '0000-00-00 00:00:00') p.lastSuccessfulSyncAt = 0;
    p.enabled = !!p.enabled;
    return p;
}

async function projectsList(userId) {
    assert.strictEqual(typeof userId, 'string');

    // we order by lastSuccessfulSyncAt so that if we hit API rate limits, each project gets a chance eventually
    const [result] = await db.query('SELECT projects.*,releases.version,releases.createdAt FROM projects LEFT JOIN releases on releases.id = (SELECT releases.id FROM releases WHERE projectId=projects.id ORDER BY createdAt DESC LIMIT 1) WHERE userId=? ORDER BY lastSuccessfulSyncAt ASC', [ userId ]);

    result.forEach(projectPostprocess);

    return result;
}

async function projectsListByType(userId, type) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof type, 'string');

    const [result] = await db.query('SELECT projects.*,releases.version,releases.createdAt FROM projects LEFT JOIN releases on releases.id = (SELECT releases.id FROM releases WHERE projectId=projects.id ORDER BY createdAt DESC LIMIT 1) WHERE userId=? AND type=?', [ userId, type ]);

    result.forEach(projectPostprocess);

    return result;
}

async function projectsAdd(project) {
    assert.strictEqual(typeof project, 'object');

    project.id = uuid.v4();
    project.enabled = true;
    project.lastSuccessfulSyncAt = 0;
    project.origin = project.origin || '';

    db.query('INSERT INTO projects (id, userId, name, origin, enabled, lastSuccessfulSyncAt, type) VALUES (?,?,?,?,?,?,?)',
        [ project.id, project.userId, project.name, project.origin, project.enabled, project.lastSuccessfulSyncAt, project.type ]);

    return projectPostprocess(project);
}

async function projectsGet(projectId) {
    assert.strictEqual(typeof projectId, 'string');

    const [result] = await db.query('SELECT * FROM projects WHERE id=?', [ projectId ]);
    if (!result.length) throw new Error('not found');

    return projectPostprocess(result[0]);
}

// we only allow updating the enabled flag for now
async function projectsUpdate(projectId, data) {
    assert.strictEqual(typeof projectId, 'string');
    assert.strictEqual(typeof data, 'object');

    await db.query('UPDATE projects SET ? WHERE id=?', [ data, projectId ]);
}

async function projectsRemove(projectId) {
    assert.strictEqual(typeof projectId, 'string');

    await db.query('DELETE FROM releases WHERE projectId=?', [ projectId ]);
    await db.query('DELETE FROM projects WHERE id=?', [ projectId ]);
}

async function usersList() {
    const [result] = await db.query('SELECT * FROM users', []);
    return result;
}

async function usersAdd(user) {
    assert.strictEqual(typeof user, 'object');

    await db.query('INSERT INTO users (id, email, githubToken) VALUES (?, ?, ?)',
        [ user.id, user.email, user.githubToken ]);

    return user;
}

async function usersGet(userId) {
    assert.strictEqual(typeof userId, 'string');

    const [result] = await db.query('SELECT * FROM users WHERE id=?', [ userId ]);
    if (!result.length) throw new Error('no such user');

    return result[0];
}

async function usersUpdate(userId, githubToken) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof githubToken, 'string');

    await db.query('UPDATE users SET githubToken=? WHERE id=?', [ githubToken, userId ]);
}

async function releasesList(projectId) {
    assert.strictEqual(typeof projectId, 'string');

    const [result] = await db.query('SELECT * FROM releases WHERE projectId=?', [ projectId ]);

    return result;
}

async function releasesAdd(release) {
    assert.strictEqual(typeof release, 'object');

    release.id = uuid.v4();
    release.createdAt = release.createdAt || 0;

    await db.query('INSERT INTO releases (id, projectId, version, body, notified, prerelease, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ release.id, release.projectId, release.version, release.body, release.notified, release.prerelease, release.createdAt ]);

    return release;
}

// we only allow updating the notfied flag for now
async function releasesUpdate(releaseId, data) {
    assert.strictEqual(typeof releaseId, 'string');
    assert.strictEqual(typeof data, 'object');

    await db.query('UPDATE releases SET notified=? WHERE id=?', [ data.notified, releaseId ]);
}

async function releasesListAllPending() {
    const [result] = await db.query('SELECT * FROM releases WHERE notified=FALSE', []);
    return result;
}
