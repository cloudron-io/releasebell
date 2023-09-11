#!/usr/bin/env node

/* jshint esversion: 8 */
/* global describe */
/* global before */
/* global after */
/* global it */

'use strict';

require('chromedriver');

const execSync = require('child_process').execSync,
    expect = require('expect.js'),
    path = require('path'),
    { Builder, By, until } = require('selenium-webdriver'),
    { Options } = require('selenium-webdriver/chrome');

if (!process.env.USERNAME || !process.env.PASSWORD || !process.env.GITHUB_TOKEN) {
    console.log('USERNAME, PASSWORD and GITHUB_TOKEN env vars need to be set');
    process.exit(1);
}

describe('Application life cycle test', function () {
    this.timeout(0);

    const LOCATION = 'test';
    const TEST_TIMEOUT = 10000;
    const EXEC_ARGS = { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' };

    const USERNAME = process.env.USERNAME;
    const PASSWORD = process.env.PASSWORD;
    const ghToken = process.env.GITHUB_TOKEN;

    let browser, app;

    before(function () {
        browser = new Builder().forBrowser('chrome').setChromeOptions(new Options().windowSize({ width: 1280, height: 1024 })).build();
    });

    after(function () {
        browser.quit();
    });

    async function visible(selector) {
        await browser.wait(until.elementLocated(selector), TEST_TIMEOUT);
        await browser.wait(until.elementIsVisible(browser.findElement(selector)), TEST_TIMEOUT);
    }

    async function login(session = false) {
        await browser.manage().deleteAllCookies();
        await browser.get(`https://${app.fqdn}`);

        await visible(By.id('loginButton'));
        await browser.findElement(By.id('loginButton')).click();

        if (!session) {
            await visible(By.xpath('//input[@name="username"]'));
            await browser.findElement(By.xpath('//input[@name="username"]')).sendKeys(USERNAME);
            await browser.findElement(By.xpath('//input[@name="password"]')).sendKeys(PASSWORD);
            await browser.findElement(By.xpath('//button[@type="submit" and contains(text(), "Sign in")]')).click();
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
        await browser.get('https://' + app.fqdn);

        await visible(By.id('settingsButton'));
        await browser.findElement(By.id('settingsButton')).click();

        await visible(By.id('githubTokenInput'));
        await browser.findElement(By.id('githubTokenInput')).sendKeys(ghToken);

        await browser.findElement(By.id('settingsSaveButton')).click();

        console.log('waiting for 5 minutes for syncing');

        await browser.sleep(5 * 60 * 1000);
    }

    async function checkProjects() {
        await browser.get('https://' + app.fqdn);
        await browser.sleep(3000);
        await browser.wait(until.elementLocated(By.xpath('//a[@href="https://github.com/cloudron-io/surfer"]')), TEST_TIMEOUT);
    }

    function getAppInfo() {
        const inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location.indexOf(LOCATION) === 0; })[0];
        expect(app).to.be.an('object');
    }

    xit('build app', function () { execSync('cloudron build', EXEC_ARGS); });
    it('install app', function () { execSync('cloudron install --location ' + LOCATION, EXEC_ARGS); });

    it('can get app information', getAppInfo);

    it('can login', login);
    it('can set gh token', setGithubToken);
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('restart app', function () { execSync('cloudron restart --app ' + app.id, EXEC_ARGS); });

    it('can login', login.bind(null, true));
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

    it('can login', login.bind(null, true));
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

    it('can login', login.bind(null, true));
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('uninstall app', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });

    // test update
    it('can install app', function () { execSync(`cloudron install --appstore-id io.cloudron.releasebell --location ${LOCATION}`, EXEC_ARGS); });

    it('can get app information', getAppInfo);
    it('can login', login);
    it('can set gh token', setGithubToken);
    it('can logout', logout);

    it('can update', function () {
        execSync('cloudron update --app ' + app.id, EXEC_ARGS);
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION; })[0];
        expect(app).to.be.an('object');
    });

    it('can login', login.bind(null, true));
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('uninstall app', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });
});
