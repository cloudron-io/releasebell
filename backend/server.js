'use strict';

var assert = require('assert'),
    connectTimeout = require('connect-timeout'),
    lastMile = require('connect-lastmile'),
    oidc = require('express-openid-connect'),
    HttpSuccess = lastMile.HttpSuccess,
    path = require('path'),
    fs = require('fs'),
    routes = require('./routes.js'),
    express = require('express');

module.exports = exports = {
    start: start
};

const baseDir = process.env.CLOUDRON ? '/app/data' : path.join(__dirname, '../.dev');

function start(port, callback) {
    assert.strictEqual(typeof port, 'number');
    assert.strictEqual(typeof callback, 'function');

    var router = express.Router();
    router.del = router.delete;

    var app = express();

    router.get ('/api/v1/login', routes.login);
    router.get ('/api/v1/status', routes.status);
    router.get ('/api/v1/profile', routes.auth, routes.profile.get);
    router.post('/api/v1/profile', routes.auth, routes.profile.update);
    router.get ('/api/v1/projects', routes.auth, routes.projects.list);
    router.post('/api/v1/projects', routes.auth, routes.projects.add);
    router.get ('/api/v1/projects/:projectId', routes.auth, routes.projects.get);
    router.post('/api/v1/projects/:projectId', routes.auth, routes.projects.update);
    router.del ('/api/v1/projects/:projectId', routes.auth, routes.projects.del);

    app.set('trust proxy', 1);

    app.use(connectTimeout(10000, { respond: true }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    if (process.env.CLOUDRON_OIDC_ISSUER) {
        app.use(oidc.auth({
            issuerBaseURL: process.env.CLOUDRON_OIDC_ISSUER,
            baseURL: process.env.CLOUDRON_APP_ORIGIN,
            clientID: process.env.CLOUDRON_OIDC_CLIENT_ID,
            clientSecret: process.env.CLOUDRON_OIDC_CLIENT_SECRET,
            secret: fs.readFileSync(path.resolve(__dirname, `${baseDir}/session.secret`), 'utf8'),
            authorizationParams: {
                response_type: 'code',
                scope: 'openid profile email'
            },
            authRequired: false,
            routes: {
                callback: '/api/v1/callback',
                login: false,
                logout: '/api/v1/logout'
            }
        }));
    } else {
        // mock oidc
        app.use((req, res, next) => {
            res.oidc = {
                login(options) {
                    res.redirect(options.authorizationParams.redirect_uri);
                }
            };
            req.oidc = {
                user: {
                    sub: 'admin',
                    family_name: 'Cloudron',
                    given_name: 'Admin',
                    locale: 'en-US',
                    name: 'Cloudron Admin',
                    preferred_username: 'admin',
                    email: 'admin@cloudron.local',
                    email_verified: true
                },
                isAuthenticated() {
                    return true;
                }
            }

            next();
        });

        app.use('/api/v1/callback', (req, res) => {
            res.redirect(req.query.returnTo || '/');
        });
    }
    app.use(router);
    app.use(express.static('./dist'));
    app.use(lastMile());
    app.listen(port, callback);
}
