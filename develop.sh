#!/bin/bash

set -eu

# create the same mysql server version to test with
CONTAINER_NAME="mysql-server-releasebell"

OUT=`docker inspect ${CONTAINER_NAME}` || true
if [[ "${OUT}" = "[]" ]]; then
    echo "=> Starting ${CONTAINER_NAME}..."
    docker run --name ${CONTAINER_NAME} -e MYSQL_ROOT_PASSWORD=password -d mysql:5.6.34
else
    echo "=> ${CONTAINER_NAME} already running. If you want to start fresh, run 'docker rm --force ${CONTAINER_NAME}'"
fi

export MYSQL_IP=`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${CONTAINER_NAME}`

echo "=> Waiting for mysql server to be ready..."
while ! mysqladmin ping -h"${MYSQL_IP}" --silent; do
    sleep 1
done

echo "=> Ensure database"
mysql -h"${MYSQL_IP}" -uroot -ppassword -e 'CREATE DATABASE IF NOT EXISTS releasebell'

export DEBUG="releasebell*"

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

echo "=> Run database migrations"
./node_modules/.bin/db-migrate up
