'use strict';

exports.up = function(db, callback) {
  db.runSql('ALTER TABLE releases ADD COLUMN prerelease BOOLEAN DEFAULT 0', callback);
};

exports.down = function(db, callback) {
    db.runSql('ALTER TABLE releases DROP COLUMN prerelease', callback);
};

