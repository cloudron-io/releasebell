'use strict';

var fs = require('fs'),
    path = require('path');

exports.up = function(db, callback) {
    var schema = fs.readFileSync(path.join(__dirname, 'initial-schema.sql')).toString('utf8');
    db.runSql(schema, callback);
};

exports.down = function(db, callback) {
    db.runSql('DROP TABLE IF EXISTS releases, projects, users', callback);
};
