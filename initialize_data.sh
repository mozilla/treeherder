#!/usr/bin/env bash
# Make non-zero exit codes & other errors fatal.
set -euo pipefail

export DATABASE_URL=${DATABASE_URL:-psql://postgres:mozilla1234@127.0.0.1:5432/treeherder}
# Only execute if we're using the Postgres container
if [ "${DATABASE_URL}" == "psql://postgres:mozilla1234@postgres:5432/treeherder" ] ||
   [ "${DATABASE_URL}" == "psql://postgres:mozilla1234@127.0.0.1:5432/treeherder" ]; then
    # Initialize migrations
    echo '-----> Running Django migrations and loading reference data'
    ./manage.py migrate --noinput
    ./manage.py load_initial_data
fi

exec "$@"