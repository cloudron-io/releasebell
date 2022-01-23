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

    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;
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

    async function login() {
        await browser.get('https://' + app.fqdn);
        await visible(By.id('username'));
        await browser.findElement(By.id('username')).sendKeys(username);
        await browser.findElement(By.id('password')).sendKeys(password);
        await browser.findElement(By.xpath('//button[@type="submit"]')).click();
        await browser.wait(until.elementLocated(By.xpath('//*[contains(text(), " Welcome to Release Bell")]')), TEST_TIMEOUT);
        await browser.sleep(3000);
    }

    async function logout() {
        await browser.get('https://' + app.fqdn);
        await browser.sleep(3000);
        await visible(By.xpath('//li[contains(text(), "Logout")]'));
        await browser.findElement(By.xpath('//li[contains(text(), "Logout")]')).click();
        await browser.findElement(By.id('username')).sendKeys(username);
    }

    async function setGithubToken() {
        await browser.get('https://' + app.fqdn);
        await browser.sleep(3000);
        await visible(By.xpath('//li[contains(text(), "Profile")]'));
        await browser.findElement(By.xpath('//li[contains(text(), "Profile")]')).click();
        await browser.findElement(By.id('githubToken')).sendKeys(ghToken);
        await browser.findElement(By.id('saveProfile')).click();
        console.log('waiting for 5 minutes for syncing');
        await browser.sleep(5 * 60 * 1000);
    }

    async function checkProjects() {
        await browser.get('https://' + app.fqdn);
        await browser.sleep(3000);
        await browser.findElement(By.xpath('//a[@href="https://github.com/cloudron-io/surfer"]'));
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
    it('can login', login);
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('backup app', function () { execSync('cloudron backup create --app ' + app.id, EXEC_ARGS); });

    it('restore app', async function () {
        await browser.get('about:blank');
        const backups = JSON.parse(execSync('cloudron backup list --raw'));
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
        execSync('cloudron install --location ' + LOCATION, EXEC_ARGS);
        getAppInfo();
        execSync(`cloudron restore --backup ${backups[0].id} --app ${app.id}`, EXEC_ARGS);
    });

    it('can login', login);
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

    it('can login', login);
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('uninstall app', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });

    // test update
    it('can install app', function () { execSync(`cloudron install --appstore-id ${app.manifest.id} --location ${LOCATION}`, EXEC_ARGS); });

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

    it('can login', login);
    it('can see projects', checkProjects);
    it('can logout', logout);

    it('uninstall app', async function () {
        await browser.get('about:blank');
        execSync('cloudron uninstall --app ' + app.id, EXEC_ARGS);
    });
});
