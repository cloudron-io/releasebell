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

function start(callback) {
    assert.strictEqual(typeof callback, 'function');

    var router = express.Router();
    router.del = router.delete;

    var app = express();

    router.get ('/api/v1/status', routes.status);
    router.get ('/api/v1/profile', routes.auth, routes.user.get);
    router.post('/api/v1/profile', routes.auth, routes.user.update);
    router.get ('/api/v1/repos', routes.auth, routes.repo.list);
    router.post('/api/v1/repos', routes.auth, routes.repo.add);
    router.get ('/api/v1/repos/:repoId', routes.auth, routes.repo.get);
    router.post('/api/v1/repos/:repoId', routes.auth, routes.repo.update);
    router.del ('/api/v1/repos/:repoId', routes.auth, routes.repo.remove);

    app
        .use(connectTimeout(10000, { respond: true }))
        .use(express.json())
        .use(express.urlencoded({ extended: true }))
        .use(router)
        .use(express.static('./frontend'))
        .use(lastMile())
        .listen(3000, callback);
}
