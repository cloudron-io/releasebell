'use strict';

exports.up = function(db, callback) {
  db.runSql('ALTER TABLE projects ADD COLUMN origin VARCHAR(512) NOT NULL DEFAULT ""', callback);
};

exports.down = function(db, callback) {
    db.runSql('ALTER TABLE projects DROP COLUMN type', callback);
};


