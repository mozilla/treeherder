#!/usr/bin/env bash
# This file is the entrypoint for the backend container.
# It takes care of making sure to wait for the mysql container to be ready

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

# Keep these in sync with DATABASE_URL.
DATABASE_HOST='mysql'
DATABASE_PORT='3306'

while ! nc -z "${DATABASE_HOST}" "${DATABASE_PORT}" &> /dev/null; do
    echo '-----> Waiting for MySQL server to be ready'
    sleep 1;
done
echo '-----> MySQL service is available'

exec "$@"
