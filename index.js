#!/usr/bin/env node

'use strict';

require('supererror');

var server = require('./backend/server.js'),
    database = require('./backend/database.js');

database.init(function (error) {
    if (error) return console.error('Failed to init database.', error);

    server.start(function (error) {
        if (error) return console.error('Failed to start server.', error);

        console.log('Server is up and running.');
    });
});
