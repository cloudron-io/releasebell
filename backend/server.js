'use strict';

var assert = require('assert'),
    connectTimeout = require('connect-timeout'),
    lastMile = require('connect-lastmile'),
    HttpSuccess = lastMile.HttpSuccess,
    routes = require('./routes.js'),
    express = require('express');

module.exports = exports = {
    start: start
};

function start(port, callback) {
    assert.strictEqual(typeof port, 'number');
    assert.strictEqual(typeof callback, 'function');

    var router = express.Router();
    router.del = router.delete;

    var app = express();

    router.get ('/api/v1/status', routes.status);
    router.get ('/api/v1/profile', routes.auth, routes.profile.get);
    router.post('/api/v1/profile', routes.auth, routes.profile.update);
    router.get ('/api/v1/projects', routes.auth, routes.projects.list);
    router.get ('/api/v1/projects/:projectId', routes.auth, routes.projects.get);
    router.post('/api/v1/projects/:projectId', routes.auth, routes.projects.update);

    app
        .use(connectTimeout(10000, { respond: true }))
        .use(express.json())
        .use(express.urlencoded({ extended: true }))
        .use(router)
        .use(express.static('./frontend'))
        .use(lastMile())
        .listen(port, callback);
}
