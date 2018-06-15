#!/bin/bash

set -eu

export NODE_ENV=production
export DEBUG="releasebell*"

echo "=> Create database.json"
cat <<EOF > /run/database.json
{
    "defaultEnv": "cloudron",
    "cloudron": {
        "host": "${MYSQL_HOST}",
        "port": ${MYSQL_PORT},
        "user": "${MYSQL_USERNAME}",
        "password": "${MYSQL_PASSWORD}",
        "database": "${MYSQL_DATABASE}",
        "driver": "mysql",
        "multipleStatements": true
    }
}
EOF

echo "=> Run db-migration"
/app/code/node_modules/.bin/db-migrate up

echo "=> Start application"
exec /usr/local/bin/gosu cloudron:cloudron node /app/code/index.js
