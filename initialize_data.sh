#!/usr/bin/env bash
# Make non-zero exit codes & other errors fatal.
set -euo pipefail

export DATABASE_URL=${DATABASE_URL:-mysql://root@127.0.0.1:3306/treeherder}
# Only execute if we're using the Mysql container
if [ "${DATABASE_URL}" == "mysql://root@mysql/treeherder" ] ||
   [ "${DATABASE_URL}" == "mysql://root@127.0.0.1:3306/treeherder" ]; then
    # Initialize migrations
    echo '-----> Running Django migrations and loading reference data'
    ./manage.py migrate --noinput
    ./manage.py load_initial_data
fi

./manage.py createcachetable

exec "$@"