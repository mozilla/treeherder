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

# Only execute if we're using the mysql container
if [ "${DATABASE_URL}" == "mysql://root@mysql/treeherder" ]; then
    # Initialize migrations and SETA
    ./initialize_data.sh
fi

exec "$@"
