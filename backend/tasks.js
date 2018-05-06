'use strict';

var assert = require('assert'),
    async = require('async'),
    database = require('./database.js'),
    nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    github = require('./github.js');

module.exports = exports = {
    run: run,
    syncStarred: syncStarred,
    syncStarredByUser: syncStarredByUser,
    syncReleases: syncReleases,
    syncReleasesByUser: syncReleasesByUser,
    sendNotifications: sendNotifications
};

const CAN_SEND_EMAIL = (process.env.MAIL_SMTP_SERVER && process.env.MAIL_SMTP_PORT && process.env.MAIL_SMTPS_PORT && process.env.MAIL_SMTP_USERNAME && process.env.MAIL_SMTP_PASSWORD && process.env.MAIL_FROM && process.env.MAIL_DOMAIN);
if (CAN_SEND_EMAIL) {
    console.log(`Can send emails. Email notifications are sent out as ${process.env.MAIL_FROM}`);
} else {
    console.log('No email configuration found. Set ');
}

function run() {
    console.log('Run periodic tasks...');

    syncStarred(function (error) {
        if (error) console.error(error);

        syncReleases(function (error) {
            if (error) console.error(error);

            sendNotifications(function (error) {
                if (error) console.error(error);

                // just keep polling for good
                setTimeout(run, 60 * 1000);
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

function sendNotificationEmail(release, callback) {
    assert.strictEqual(typeof release, 'object');
    assert.strictEqual(typeof callback, 'function');

    if (!CAN_SEND_EMAIL) return callback();

    database.projects.get(release.projectId, function (error, project) {
        if (error) return callback(error);

        database.users.get(project.userId, function (error, user) {
            if (error) return callback(error);

            var transport = nodemailer.createTransport(smtpTransport({
                host: process.env.MAIL_SMTP_SERVER,
                port: process.env.MAIL_SMTP_PORT,
                auth: {
                    user: process.env.MAIL_SMTP_USERNAME,
                    pass: process.env.MAIL_SMTP_PASSWORD
                }
            }));

            var mail = {
                from: process.env.MAIL_FROM,
                to: user.email,
                subject: `${project.name} ${release.version} released`,
                text: `A new release at ${project.name} with version ${release.version} has been made.`
            };

            console.log('Sending email:', mail);

            transport.sendMail(mail, function (error) {
                if (error) return callback(error);

                database.releases.update(release.id, { notified: true }, callback);
            });
        });
    });
}

function sendNotifications(callback) {
    assert.strictEqual(typeof callback, 'function');

    database.releases.listAllPending(function (error, result) {
        if (error) return callback(error);

        async.each(result, function (release, callback) {
            sendNotificationEmail(release, function (error) {
                if (error) console.error(error);

                // ignore individual errors
                callback();
            });
        }, callback);
    });
}