#!/bin/bash

set -eu

export NODE_ENV=production
export DEBUG="releasebell*"

echo "=> Create database.json"
cat <<EOF > /run/database.json
{
    "defaultEnv": "cloudron",
    "cloudron": {
        "host": "${CLOUDRON_MYSQL_HOST}",
        "port": ${CLOUDRON_MYSQL_PORT},
        "user": "${CLOUDRON_MYSQL_USERNAME}",
        "password": "${CLOUDRON_MYSQL_PASSWORD}",
        "database": "${CLOUDRON_MYSQL_DATABASE}",
        "driver": "mysql",
        "multipleStatements": true
    }
}
EOF

echo "=> Run db-migration"
/app/code/node_modules/.bin/db-migrate up

echo "=> Start application"
exec /usr/local/bin/gosu cloudron:cloudron node /app/code/index.js
