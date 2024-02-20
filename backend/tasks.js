'use strict';

const assert = require('assert'),
    fs = require('fs'),
    database = require('./database.js'),
    debug = require('debug')('releasebell/tasks'),
    github = require('./github.js'),
    gitlab = require('./gitlab.js'),
    handlebars = require('handlebars'),
    markdown = require('helper-markdown'),
    nodemailer = require('nodemailer'),
    path = require('path'),
    smtpTransport = require('nodemailer-smtp-transport');

// Register our Markdown helper
handlebars.registerHelper('markdown', function(text) {
    text = markdown(text);
    return new handlebars.SafeString(text);
});

module.exports = exports = {
    run,
    syncReleasesByProject // for initial sync on project add
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

async function run() {
    if (gTasksActive) return debug('run: already running');

    gTasksActive = true;

    debug('run: start');

    try {
        await syncProjects();
    } catch (error) {
        console.error('Failed to sync projects', error);
    }

    try {
        await syncReleases();
    } catch (error) {
        console.error('Failed to sync releases', error);
    }

    try {
        await sendNotifications();
    } catch (error) {
        console.error('Failed to send notifications', error);
    }

    // just keep polling for good every hour otherwise whenever github tells us we can try again + 60sec
    const nextRun = gRetryAt ? ((60*1000) + (gRetryAt - Date.now())) : (60 * 60 * 1000);

    gRetryAt = 0;
    gTasksActive = false;

    debug(`run: done. Next run in ${nextRun/1000}s at ${new Date(nextRun + Date.now())}`);

    setTimeout(run, nextRun);
}

async function syncProjects() {
    const users = await database.users.list();

    shuffleArray(users);

    // errors are ignored here
    for (let user of users) {
        try {
            await syncGithubStarredByUser(user);
        } catch (error) {
            console.error(error);
        }
    }
}

async function syncGithubStarredByUser(user) {
    assert.strictEqual(typeof user, 'object');

    if (!user.githubToken) return '';

    debug('syncGithubStarredByUser: ', user.id);

    const result = await github.getStarred(user.githubToken);

    debug(`syncGithubStarredByUser: found ${result.length} starred repos`);

    // translate from github to internal model
    const starredProjects = result.map(function (p) { return { name: p.full_name }; });

    const trackedProjects = await database.projects.listByType(user.id, database.PROJECT_TYPE_GITHUB);

    const newProjects = starredProjects.filter(function (a) { return !trackedProjects.find(function (b) { return a.name === b.name; }); });
    const outdatedProjects = trackedProjects.filter(function (a) { return !starredProjects.find(function (b) { return a.name === b.name; }); });

    debug(`syncGithubStarredByUser: new projects: ${newProjects.length} outdated projects: ${outdatedProjects.length}`);

    for (let project of newProjects) {
        debug(`syncGithubStarredByUser: [${project.name}] is new for user ${user.id}`);

        // we add projects first with release notification disabled
        const result = await database.projects.add({ type: database.PROJECT_TYPE_GITHUB, userId: user.id, name: project.name });

        // force an initial release sync
        await syncReleasesByProject(user, result);
    }

    for (let project of outdatedProjects) {
        debug(`syncGithubStarredByUser: [${project.name}] not starred anymore by ${user.id}`);

        try {
            await database.projects.remove(project.id);
        } catch (error) {
            console.error(`Failed to remove outdated project ${project.name} for ${user.id}`, error);
        }
    }
}

async function syncReleasesByProject(user, project) {
    assert.strictEqual(typeof user, 'object');
    assert.strictEqual(typeof project, 'object');

    debug(`syncReleasesByProject: [${project.name}] type ${project.type} start sync releases, notifications are ${project.enabled ? 'enabled' : 'disabled'}. Last successful sync was at`, new Date(project.lastSuccessfulSyncAt));

    var api;
    if (project.type === database.PROJECT_TYPE_GITHUB) {
        api = github;
    } else if (project.type === database.PROJECT_TYPE_GITHUB_MANUAL) {
        api = github;
    } else if (project.type === database.PROJECT_TYPE_GITLAB) {
        api = gitlab;
    } else {
        debug(`syncReleasesByProject: [${project.name}] unknown type ${project.type}. Ignoring for now`);
        return;
    }

    const upstreamReleases = await api.getReleases(user.githubToken, project);
    const trackedReleases = await database.releases.list(project.id);

    const newReleases = upstreamReleases.filter(function (a) { return !trackedReleases.find(function (b) { return a.version == b.version; }); });

    debug(`syncReleasesByProject: [${project.name}] found ${newReleases.length} new releases`);

    // only get the full commit for new releases
    for (let release of newReleases) {
        // before initial successful sync and if notifications for this project are enabled, we mark the release as not notified yet
        release.notified = !project.lastSuccessfulSyncAt ? true : !project.enabled;
        release.body = '';
        release.createdAt = 0;
        release.prerelease = false;

        // skip fetching details for notification which will not be sent
        if (release.notified) {
            await database.releases.add(release);
            continue;
        }

        try {
            const result = await api.getRelease(user.githubToken, project, release.version); // { body, prerelease }
            release.body = result.body;
            release.prerelease = result.prerelease;
        } catch (error) {
            console.error(`Failed to get release body for ${project.name} ${release.version}. Falling back to commit message.`, error);
            release.body = '';
            release.prerelease = false;
        }

        const commit = await api.getCommit(user.githubToken, project, release.sha);

        release.createdAt = new Date(commit.createdAt).getTime() || 0;
        // old code did not get all tags properly. this hack limits notifications to last 10 days
        if (Date.now() - release.createdAt > 10 * 24 * 60 * 60 * 1000) release.notified = true;

        debug(`syncReleasesByProject: [${project.name}] add release ${release.version} from ${release.createdAt} as ${new Date(commit.createdAt)} notified ${release.notified}`);

        if (!release.body) {
            // Set fallback body to the commit's message
            const fullBody = 'Latest commit message: \n' + commit.message;
            const releaseBody = fullBody.length > 1000 ? fullBody.substring(0, 1000) + '...' : fullBody;
            release.body = releaseBody;
        } else { // TEXT can only hold 65535
            release.body = release.body.length > 65000 ? release.body.substring(0, 65000) + '...' : release.body;
        }

        await database.releases.add(release);
    }

    debug(`syncReleasesByProject: [${project.name}] successfully synced`);

    // set the last successful sync time
    await database.projects.update(project.id, { lastSuccessfulSyncAt: Date.now() });
}

async function syncReleasesByUser(user) {
    assert.strictEqual(typeof user, 'object');

    const projects = await database.projects.list(user.id);

    shuffleArray(projects);

    for (let project of projects) {
        await syncReleasesByProject(user, project);
    }
}

async function syncReleases() {
    const users = await database.users.list();

    shuffleArray(users);

    for (let user of users) {
        try {
            await syncReleasesByUser(user);
        } catch (error) {
            console.error(`Failed to get releases for user ${user.id}. Continuing...`, error);
        }
    }
}

async function sendNotificationEmail(release) {
    assert.strictEqual(typeof release, 'object');

    if (!CAN_SEND_EMAIL) {
        console.log('Would send email for release', release);
        return;
    }

    const project = await database.projects.get(release.projectId);
    const user = await database.users.get(project.userId);

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
        subject: `${project.name} ${release.version}${release.prerelease ? ' (prerelease)' : ''} released`,
        text: `A new ${release.prerelease ? 'prerelease' : 'release'} at ${project.name} with version ${release.version} was published. ${release.body}. Read more about this release at ${versionLink}`,
        html: EMAIL_TEMPLATE({ project, release, versionLink, settingsLink })
    };

    await transport.sendMail(mail);
    await database.releases.update(release.id, { notified: true });
}

async function sendNotifications() {
    const result = await database.releases.listAllPending();

    // ignore individual errors
    for (let release of result) {
        try {
            await sendNotificationEmail(release);
        } catch (error) {
            console.error(`Failed to send notification email for release ${release.projectId}/${release.version}`, error);
        }
    }
}
