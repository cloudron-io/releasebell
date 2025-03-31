#!/bin/bash

set -eu

export NODE_ENV=production
export DEBUG="releasebell*"

# Creating a secret for web sessions
if [[ ! -f /app/data/session.secret ]]; then
    echo "==> Generating session secret"
    dd if=/dev/urandom bs=256 count=1 2>/dev/null | base64 > /app/data/session.secret
fi

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
gosu cloudron:cloudron /app/code/node_modules/.bin/db-migrate up

echo "=> Start application"
exec /usr/local/bin/gosu cloudron:cloudron node /app/code/index.js
