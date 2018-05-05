'use strict';

var assert = require('assert'),
    async = require('async'),
    database = require('./database.js'),
    github = require('./github.js');

module.exports = exports = {
    init: init,
    syncStarred: syncStarred,
    syncStarredByUser: syncStarredByUser,
    syncReleases: syncReleases,
    syncReleasesByUser: syncReleasesByUser,
    sendNotifications: sendNotifications
};

function init(callback) {
    assert.strictEqual(typeof callback, 'function');

    // callback early for now
    callback();

    syncStarred(function (error) {
        if (error) console.error(error);

        syncReleases(function (error) {
            if (error) console.error(error);

            sendNotifications(function (error) {
                if (error) console.error(error);
            });
        });
    });
}

function syncStarred(callback) {
    assert.strictEqual(typeof callback, 'function');

    database.users.list(function (error, result) {
        if (error) return callback(error);

        // skip users without a github token
        var users = result.filter(function (u) { return !!u.githubToken; });

        async.each(users, function (user, callback) {
            syncStarredByUser(user, function (error) {
                if (error) console.error(error);

                // errors are ignored here
                callback();
            });
        }, callback);
    });
}

function syncStarredByUser(user, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof callback, 'function');

    if (!user.githubToken) return callback();

    github.getStarred(user.githubToken, function (error, result) {
        if (error) return callback(error);

        // translate from github to internal model
        var starredProjects = result.map(function (p) { return { name: p.full_name }; });

        database.projects.list(user.id, function (error, trackedProjects) {
            if (error) return callback(error);

            var newProjects = starredProjects.filter(function (a) { return !trackedProjects.find(function (b) { return a.name === b.name; }); });
            var outdatedProjects = trackedProjects.filter(function (a) { return !starredProjects.find(function (b) { return a.name === b.name; }); });

            async.each(newProjects, function (project, callback) {
                database.projects.add({ userId: user.id, name: project.name }, function (error, result) {
                    if (error) return callback(error);

                    // force an initial release sync without notification
                    syncReleasesByProject(user, result, true, callback);
                });
            }, function (error) {
                if (error) return callback(error);

                async.each(outdatedProjects, function (project, callback) {
                    database.projects.remove(project.id, callback);
                }, function (error) {
                    if (error) return callback(error);

                    callback();
                });
            });
        });
    });
}

function syncReleasesByProject(user, project, notified, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof notified, 'boolean');
    assert.strictEqual(typeof callback, 'function');

    github.getReleases(user.githubToken, project, function (error, result) {
        if (error) return callback(error);

        // map to internal model
        var upstreamReleases = result.map(function (r) { return { projectId: project.id, version: r.name }; });

        database.releases.list(project.id, function (error, trackedReleases) {
            if (error) return callback(error);

            var newReleases = upstreamReleases.filter(function (a) { return !trackedReleases.find(function (b) { return a.version == b.version; }); });

            async.each(newReleases, function (release, callback) {
                release.notified = notified;
                database.releases.add(release, callback);
            }, callback);
        });
    });
}

function syncReleasesByUser(user, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof callback, 'function');

    database.projects.list(user.id, function (error, result) {
        if (error) return callback(error);

        async.each(result, function (project, callback) {
            syncReleasesByProject(user, project, false, callback);
        }, function (error) {
            if (error) console.error(error);
            callback();
        });
    });
}

function syncReleases(callback) {
    assert.strictEqual(typeof callback, 'function');

    database.users.list(function (error, result) {
        if (error) return callback(error);

        // skip users without a github token
        var users = result.filter(function (u) { return !!u.githubToken; });

        async.each(users, function (user, callback) {
            syncReleasesByUser(user, function (error) {
                if (error) console.error(error);

                // errors are ignored here
                callback();
            });
        }, callback);
    });
}

function sendNotifications(callback) {
    assert.strictEqual(typeof callback, 'function');

    database.releases.listAllPending(function (error, result) {
        if (error) return callback(error);

        console.log('Pending release notifications:', result);

        callback();
    });
}