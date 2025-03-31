#!/usr/bin/env node

/* global it, xit, describe, before, afterEach */

'use strict';

require('chromedriver');

const execSync = require('child_process').execSync,
    expect = require('expect.js'),
    fs = require('fs'),
    path = require('path'),
    { Builder, By, until } = require('selenium-webdriver'),
    { Options } = require('selenium-webdriver/chrome');

describe('Application life cycle test', function () {
    this.timeout(0);

    const LOCATION = process.env.LOCATION || 'test';
    const TEST_TIMEOUT = 10000;
    const EXEC_ARGS = { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' };

    const USERNAME = process.env.USERNAME;
    const PASSWORD = process.env.PASSWORD;
    // const TIMEOUT = parseInt(process.env.TIMEOUT) || 40000;
    const ghToken = process.env.GITHUB_TOKEN;

    let browser, app;

    before(function () {
        const chromeOptions = new Options().windowSize({ width: 1280, height: 1024 });
        if (process.env.CI) chromeOptions.addArguments('no-sandbox', 'disable-dev-shm-usage', 'headless');
        chromeOptions.addArguments('disable-notifications');
        browser = new Builder().forBrowser('chrome').setChromeOptions(chromeOptions).build();
        if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
    });

    afterEach(async function () {
        if (!process.env.CI || !app) return;

        const currentUrl = await browser.getCurrentUrl();
        if (!currentUrl.includes(app.domain)) return;
        expect(this.currentTest.title).to.be.a('string');

        const screenshotData = await browser.takeScreenshot();
        fs.writeFileSync(`./screenshots/${new Date().getTime()}-${this.currentTest.title.replaceAll(' ', '_')}.png`, screenshotData, 'base64');
    });

    async function visible(selector) {
        await browser.wait(until.elementLocated(selector), TEST_TIMEOUT);
        await browser.wait(until.elementIsVisible(browser.findElement(selector)), TEST_TIMEOUT);
    }

    async function login(hasSession = false) {
        await browser.manage().deleteAllCookies();
        await browser.get(`https://${app.fqdn}`);

        await visible(By.id('loginButton'));
        await browser.findElement(By.id('loginButton')).click();

        if (!hasSession) {
            await visible(By.id('inputUsername'));
            await browser.findElement(By.id('inputUsername')).sendKeys(USERNAME);
            await browser.findElement(By.id('inputPassword')).sendKeys(PASSWORD);
            await browser.findElement(By.id('loginSubmitButton')).click();
        }

        await visible(By.id('logoutButton'));
    }

    async function logout() {
        await browser.get('https://' + app.fqdn);

        await visible(By.id('logoutButton'));
        await browser.findElement(By.id('logoutButton')).click();

        await visible(By.id('loginButton'));
    }

    async function setGithubToken() {
        if (process.env.CI) return;

        await browser.get('https://' + app.fqdn);

        await visible(By.id('settingsButton'));
        await browser.findElement(By.id('settingsButton')).click();

        await visible(By.id('githubTokenInput'));
        await browser.findElement(By.id('githubTokenInput')).sendKeys(ghToken);

        await browser.findElement(By.id('settingsSaveButton')).click();

        execSync('spd-say "Waiting for 10 mins for sync"');
        console.log('waiting for 10 minutes for syncing');

        await browser.sleep(10 * 60 * 1000);

        execSync('spd-say "Resuming test after sync"');
    }

    async function checkProjects() {
        if (process.env.CI) return;

        await browser.get('https://' + app.fqdn);
        await browser.sleep(3000);
        await browser.wait(until.elementLocated(By.xpath('//td/a[contains(@href, "https://github.com/")]')), TEST_TIMEOUT);
    }

    function getAppInfo() {
        const inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location.indexOf(LOCATION) === 0; })[0];
        expect(app).to.be.an('object');
    }

    xit('build app', function () { execSync('cloudron build', EXEC_ARGS); });
    it('install app', function () { execSync('cloudron install --location ' + LOCATION, EXEC_ARGS); });

    it('can get app information', getAppInfo);

    it('can login', login.bind(null, false /* hasSession */));
    it('can set gh token', setGithubToken);
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('restart app', function () { execSync('cloudron restart --app ' + app.id, EXEC_ARGS); });

    it('can login', login.bind(null, true /* hasSession */));
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('backup app', function () { execSync('cloudron backup create --app ' + app.id, EXEC_ARGS); });

    it('restore app', async function () {
        await browser.get('about:blank');
        const backups = JSON.parse(execSync(`cloudron backup list --raw --app ${app.id}`));
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
        execSync('cloudron install --location ' + LOCATION, EXEC_ARGS);
        getAppInfo();
        execSync(`cloudron restore --backup ${backups[0].id} --app ${app.id}`, EXEC_ARGS);
    });

    it('can login', login.bind(null, true /* hasSession */));
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('move to different location', async function () {
        browser.manage().deleteAllCookies();
        await browser.get('about:blank');
        execSync('cloudron configure --location ' + LOCATION + '2 --app ' + app.id, EXEC_ARGS);
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION + '2'; })[0];
        expect(app).to.be.an('object');
    });

    it('can login', login.bind(null, true /* hasSession */));
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('uninstall app', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });

    // test update
    it('can install app', function () { execSync(`cloudron install --appstore-id io.cloudron.releasebell --location ${LOCATION}`, EXEC_ARGS); });

    it('can get app information', getAppInfo);
    it('can login', login.bind(null, true /* hasSession */));
    it('can set gh token', setGithubToken);
    it('can logout', logout);

    it('can update', function () {
        execSync('cloudron update --app ' + app.id, EXEC_ARGS);
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION; })[0];
        expect(app).to.be.an('object');
    });

    it('can login', login.bind(null, true /* hasSession */));
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('uninstall app', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });
});
