#!/usr/bin/env node

/* jshint esversion: 8 */
/* global describe */
/* global before */
/* global after */
/* global it */

'use strict';

require('chromedriver');

var execSync = require('child_process').execSync,
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

    function visible(selector) {
        return browser.wait(until.elementLocated(selector), TEST_TIMEOUT)
            .then(function () {
                return browser.wait(until.elementIsVisible(browser.findElement(selector)), TEST_TIMEOUT);
            });
    }

    function login(callback) {
        browser.get('https://' + app.fqdn).then(function () {
            return visible(By.id('username'));
        }).then(function () {
            return browser.findElement(By.id('username')).sendKeys(username);
        }).then(function () {
            return browser.findElement(By.id('password')).sendKeys(password);
        }).then(function () {
            return browser.findElement(By.xpath('//button[@type="submit"]')).click();
        }).then(function () {
            return browser.wait(until.elementLocated(By.xpath('//*[contains(text(), " Welcome to Release Bell")]')), TEST_TIMEOUT);
        }).then(function () {
            return browser.sleep(3000);
        }).then(function () {
            callback();
        });
    }

    function logout(callback) {
        browser.get('https://' + app.fqdn).then(function () {
            return browser.sleep(3000);
        }).then(function () {
            return visible(By.xpath('//li[contains(text(), "Logout")]'));
        }).then(function () {
            return browser.findElement(By.xpath('//li[contains(text(), "Logout")]')).click();
        }).then(function () {
            return browser.findElement(By.id('username')).sendKeys(username);
        }).then(function () {
            callback();
        });
    }

    function setGithubToken(callback) {
        browser.get('https://' + app.fqdn).then(function () {
            return browser.sleep(3000);
        }).then(function () {
            return visible(By.xpath('//li[contains(text(), "Profile")]'));
        }).then(function () {
            return browser.findElement(By.xpath('//li[contains(text(), "Profile")]')).click();
        }).then(function () {
            return browser.findElement(By.id('githubToken')).sendKeys(ghToken);
        }).then(function () {
            return browser.findElement(By.id('saveProfile')).click();
        }).then(function () {
            console.log('waiting for 5 minutes for syncing');
            return browser.sleep(5 * 60 * 1000);
        }).then(function () {
            callback();
        });
    }

    function checkProjects(callback) {
        browser.get('https://' + app.fqdn).then(function () {
            return browser.sleep(3000);
        }).then(function () {
            return browser.findElement(By.xpath('//a[@href="https://github.com/cloudron-io/surfer"]'));
        }).then(function () {
            callback();
        });
    }

    function getAppInfo() {
        var inspect = JSON.parse(execSync('cloudron inspect'));
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
