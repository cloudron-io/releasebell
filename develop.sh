#!/bin/bash

set -eu

# create the same mysql server version to test with
CONTAINER_NAME="mysql-server-releasebell"

OUT=`docker inspect ${CONTAINER_NAME}` || true
if [[ "${OUT}" = "[]" ]]; then
    echo "=> Starting ${CONTAINER_NAME}..."
    docker run --name ${CONTAINER_NAME} -e MYSQL_ROOT_PASSWORD=password -d mysql:8.0
else
    echo "=> ${CONTAINER_NAME} already running. If you want to start fresh, run 'docker rm --force ${CONTAINER_NAME}'"
fi

export MYSQL_IP=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${CONTAINER_NAME}`

echo "=> Waiting for mysql server to be ready..."
while ! mysqladmin ping -h"${MYSQL_IP}" --silent; do
    sleep 1
done

echo "=> Configure mysql to allow password login"
mysql -h"${MYSQL_IP}" -uroot -ppassword -e "ALTER USER 'root' IDENTIFIED WITH mysql_native_password BY 'password'; FLUSH PRIVILEGES;"

echo "=> Ensure database"
mysql -h"${MYSQL_IP}" -uroot -ppassword -e 'CREATE DATABASE IF NOT EXISTS releasebell'

export DEBUG="releasebell*"

echo "=> Generating session secret"
mkdir -p ./.dev
dd if=/dev/urandom bs=256 count=1 2>/dev/null | base64 > ./.dev/session.secret

echo "=> Create database.json"
cat <<EOF > ./database.json
{
    "defaultEnv": "local",
    "local": {
        "host": "${MYSQL_IP}",
        "user": "root",
        "password": "password",
        "database": "releasebell",
        "driver": "mysql",
        "multipleStatements": true
    }
}
EOF

echo "=> Build frontend"
npm run build

echo "=> Run database migrations"
./node_modules/.bin/db-migrate up

echo "=> Start releasebell"
./index.js