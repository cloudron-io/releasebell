'use strict';

exports.up = function(db, callback) {
  db.runSql('ALTER TABLE releases ADD COLUMN body TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', callback);
};

exports.down = function(db, callback) {
    db.runSql('ALTER TABLE releases DROP COLUMN body', callback);
};

