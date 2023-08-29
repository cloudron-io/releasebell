'use strict';

var assert = require('assert'),
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    database = require('./database.js'),
    nodemailer = require('nodemailer'),
    handlebars = require('handlebars'),
    markdown = require('helper-markdown'),
    debug = require('debug')('releasebell/tasks'),
    smtpTransport = require('nodemailer-smtp-transport'),
    gitlab = require('./gitlab.js'),
    github = require('./github.js');

// Register our Markdown helper
handlebars.registerHelper('markdown', function(text) {
    text = markdown(text);
    return new handlebars.SafeString(text);
});

module.exports = exports = {
    run: run,
    syncReleasesByProject: syncReleasesByProject // for initial sync on project add
};

const CAN_SEND_EMAIL = (process.env.CLOUDRON_MAIL_SMTP_SERVER && process.env.CLOUDRON_MAIL_SMTP_PORT && process.env.CLOUDRON_MAIL_FROM);
if (CAN_SEND_EMAIL) {
    console.log(`Can send emails. Email notifications are sent out as ${process.env.CLOUDRON_MAIL_FROM}`);
} else {
    console.log(`
No email configuration found. Set the following environment variables:
    CLOUDRON_MAIL_SMTP_SERVER
    CLOUDRON_MAIL_SMTP_PORT
    CLOUDRON_MAIL_SMTP_USERNAME
    CLOUDRON_MAIL_SMTP_PASSWORD
    CLOUDRON_MAIL_FROM
    `);
}

const EMAIL_TEMPLATE = handlebars.compile(fs.readFileSync(path.resolve(__dirname, 'notification.template'), 'utf8'));
let gTasksActive = false;
let gRetryAt = 0;

// https://www.w3docs.com/snippets/javascript/how-to-randomize-shuffle-a-javascript-array.html
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function run() {
    if (gTasksActive) return debug('run: already running');

    gTasksActive = true;

    debug('run: start');

    syncProjects(function (error) {
        if (error) console.error(error);

        syncReleases(function (error) {
            if (error) console.error(error);

            sendNotifications(function (error) {
                if (error) console.error(error);

                // just keep polling for good every hour otherwise whenever github tells us we can try again + 60sec
                const nextRun = gRetryAt ? ((60*1000) + (gRetryAt - Date.now())) : (60 * 60 * 1000);

                gRetryAt = 0;
                gTasksActive = false;

                debug(`run: done. Next run in ${nextRun/1000}s at ${new Date(nextRun + Date.now())}`);

                setTimeout(run, nextRun);
            });
        });
    });
}

async function syncProjects(callback) {
    assert.strictEqual(typeof callback, 'function');

    let list;
    try {
        list = await database.users.list();
    } catch (error) {
        return callback(error);
    }

    shuffleArray(list);

    async.each(list, function (user, callback) {
        // errors are ignored here
        syncGithubStarredByUser(user, function (error) {
            if (error) console.error(error);

            callback();
        });
    }, callback);
}

function syncGithubStarredByUser(user, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof callback, 'function');

    if (!user.githubToken) return callback();

    debug('syncGithubStarredByUser: ', user.id);

    github.getStarred(user.githubToken, async function (error, result) {
        if (error) return callback(error);

        debug(`syncGithubStarredByUser: found ${result.length} starred repos`);

        // translate from github to internal model
        const starredProjects = result.map(function (p) { return { name: p.full_name }; });

        let trackedProjects;
        try {
            trackedProjects = await database.projects.listByType(user.id, database.PROJECT_TYPE_GITHUB);
        } catch (error) {
            return callback(error);
        }

        const newProjects = starredProjects.filter(function (a) { return !trackedProjects.find(function (b) { return a.name === b.name; }); });
        const outdatedProjects = trackedProjects.filter(function (a) { return !starredProjects.find(function (b) { return a.name === b.name; }); });

        debug(`syncGithubStarredByUser: new projects: ${newProjects.length} outdated projects: ${outdatedProjects.length}`);

        // do not overwhelm github api with async.each() we hit rate limits if we do
        async.eachSeries(newProjects, function (project, callback) {
            debug(`syncGithubStarredByUser: [${project.name}] is new for user ${user.id}`);

            // we add projects first with release notification disabled
            database.projects.add({ type: database.PROJECT_TYPE_GITHUB, userId: user.id, name: project.name }, function (error, result) {
                if (error) return callback(error);

                // force an initial release sync
                syncReleasesByProject(user, result, callback);
            });
        }, async function (error) {
            if (error) return callback(error);

            for (let project of outdatedProjects) {
                debug(`syncGithubStarredByUser: [${project.name}] not starred anymore by ${user.id}`);

                try {
                    await database.projects.remove(project.id);
                } catch (error) {
                    console.error(`Failed to remove outdated project ${project.name} for ${user.id}`, error);
                }
            }

            callback();
        });
    });
}

function syncReleasesByProject(user, project, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof project, 'object');
    assert.strictEqual(typeof callback, 'function');

    debug(`syncReleasesByProject: [${project.name}] type ${project.type} start sync releases. Last successful sync was at`, new Date(project.lastSuccessfulSyncAt));

    var api;
    if (project.type === database.PROJECT_TYPE_GITHUB) {
        api = github;
    } else if (project.type === database.PROJECT_TYPE_GITHUB_MANUAL) {
        api = gitlab;
    } else if (project.type === database.PROJECT_TYPE_GITLAB) {
        api = gitlab;
    } else {
        debug(`syncReleasesByProject: [${project.name}] unknown type ${project.type}. Ignoring for now`);
        return callback();
    }

    api.getReleases(user.githubToken, project, async function (error, upstreamReleases) {
        if (error) return callback(error);

        let trackedReleases;
        try {
            trackedReleases = await database.releases.list(project.id);
        } catch (error) {
            return callback(error);
        }

        const newReleases = upstreamReleases.filter(function (a) { return !trackedReleases.find(function (b) { return a.version == b.version; }); });

        debug(`syncReleasesByProject: [${project.name}] found ${newReleases.length} new releases`);

        // only get the full commit for new releases
        async.eachLimit(newReleases, 10, function (release, callback) {
            // before initial successful sync and if notifications for this project are enabled, we mark the release as not notified yet
            release.notified = !project.lastSuccessfulSyncAt ? true : !project.enabled;
            release.body = '';
            release.createdAt = 0;

            // skip fetching details for notification which will not be sent
            if (release.notified) {
                return (async function inner() {
                    let result;
                    try {
                        result = await database.releases.add(release);
                    } catch (error) {
                        return callback(error);
                    }

                    return callback(null, result);
                })();
            }

            api.getReleaseBody(user.githubToken, project, release.version, function (error, result) {
                if (error) console.error(`Failed to get release body for ${project.name} ${release.version}. Falling back to commit message.`, error);

                release.body = result || '';

                api.getCommit(user.githubToken, project, release.sha, async function (error, commit) {
                    if (error) return callback(error);

                    release.createdAt = new Date(commit.createdAt).getTime();
                    // old code did not get all tags properly. this hack limits notifications to last 10 days
                    if (Date.now() - release.createdAt > 10 * 24 * 60 * 60 * 1000) release.notified = true;

                    debug(`syncReleasesByProject: [${project.name}] add release ${release.version} notified ${release.notified}`);

                    if (!release.body) {
                        // Set fallback body to the commit's message
                        const fullBody = 'Latest commit message: \n' + commit.message;
                        const releaseBody = fullBody.length > 1000 ? fullBody.substring(0, 1000) + '...' : fullBody;
                        release.body = releaseBody;
                    }

                    let result;
                    try {
                        result = await database.releases.add(release);
                    } catch (error) {
                        return callback(error);
                    }

                    callback(null, result);
                });
            });
        }, async function (error) {
            if (error) return callback(error);

            debug(`syncReleasesByProject: [${project.name}] successfully synced`);

            // set the last successful sync time
            try {
                await database.projects.update(project.id, { lastSuccessfulSyncAt: Date.now() });
            } catch (error) {
                return callback(error);
            }

            callback();
        });
    });
}

async function syncReleasesByUser(user, callback) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof callback, 'function');

    let projects;
    try {
        projects = await database.projects.list(user.id);
    } catch (error) {
        return callback(error);
    }

    shuffleArray(projects);

    async.eachSeries(projects, function (project, callback) {
        syncReleasesByProject(user, project, callback);
    }, callback);
}

async function syncReleases(callback) {
    assert.strictEqual(typeof callback, 'function');

    let list;
    try {
        list = await database.users.list();
    } catch (error) {
        return callback(error);
    }

    shuffleArray(list);

    async.eachSeries(list, function (user, callback) {
        syncReleasesByUser(user, function (error) {
            if (error) console.error(error);
            if (error && error.retryAt) gRetryAt = error.retryAt;

            // errors are ignored here
            callback();
        });
    }, callback);
}

async function sendNotificationEmail(release, callback) {
    assert.strictEqual(typeof release, 'object');
    assert.strictEqual(typeof callback, 'function');

    if (!CAN_SEND_EMAIL) {
        console.log('Would send email for release', release);
        return callback();
    }

    let project;
    try {
        project = await database.projects.get(release.projectId);
    } catch (error) {
        return callback(error);
    }

    let user;
    try {
        user = database.users.get(project.userId);
    } catch (error) {
        return callback(error);
    }

    const transport = nodemailer.createTransport(smtpTransport({
        host: process.env.CLOUDRON_MAIL_SMTP_SERVER,
        port: process.env.CLOUDRON_MAIL_SMTP_PORT,
        auth: {
            user: process.env.CLOUDRON_MAIL_SMTP_USERNAME,
            pass: process.env.CLOUDRON_MAIL_SMTP_PASSWORD
        }
    }));

    let versionLink;
    if (project.type === database.PROJECT_TYPE_GITHUB) {
        versionLink = `https://github.com/${project.name}/releases/tag/${release.version}`;
    } else if (project.type === database.PROJECT_TYPE_GITLAB) {
        versionLink = `${project.origin}/${project.name}/-/tags/${release.version}`;
    }
    const settingsLink = process.env.CLOUDRON_APP_ORIGIN || '';

    const mail = {
        from: `ReleaseBell <${process.env.CLOUDRON_MAIL_FROM}>`,
        to: user.email,
        subject: `${project.name} ${release.version} released`,
        text: `A new release at ${project.name} with version ${release.version} was published. ${release.body}. Read more about this release at ${versionLink}`,
        html: EMAIL_TEMPLATE({ project: project, release: release, versionLink: versionLink, settingsLink: settingsLink })
    };

    transport.sendMail(mail, async function (error) {
        if (error) return callback(error);

        try {
            await database.releases.update(release.id, { notified: true });
        } catch (error) {
            return callback(error);
        }

        callback(null);
    });
}

async function sendNotifications(callback) {
    assert.strictEqual(typeof callback, 'function');

    let result;
    try {
        result = await database.releases.listAllPending();
    } catch (error) {
        return callback(error);
    }

    async.eachSeries(result, function (release, callback) {
        sendNotificationEmail(release, function (error) {
            if (error) console.error(error);

            // ignore individual errors
            callback();
        });
    }, callback);
}
