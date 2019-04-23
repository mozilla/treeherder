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

RUN_MIGRATIONS=${RUN_MIGRATIONS:-False}
if [[ "${RUN_MIGRATIONS}" == 'True' ]]; then
    echo '-----> Running Django migrations and loading reference data'
    ./manage.py migrate --noinput
    ./manage.py load_initial_data
fi

echo '-----> Setup complete!'

exec "$@"
