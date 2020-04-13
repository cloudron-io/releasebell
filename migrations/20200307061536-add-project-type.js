'use strict';

var async = require('async');

exports.up = function(db, callback) {
    async.series([
        db.runSql.bind(db, 'ALTER TABLE projects ADD COLUMN type VARCHAR(32) NOT NULL DEFAULT "github"'),
        db.runSql.bind(db, 'ALTER TABLE projects MODIFY COLUMN type VARCHAR(32)')
    ], callback)
};

exports.down = function(db, callback) {
    db.runSql('ALTER TABLE projects DROP COLUMN type', callback);
};
