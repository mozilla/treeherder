#!/usr/bin/env bash
# Make non-zero exit codes & other errors fatal.
set -euo pipefail

# Only execute if we're using the Mysql container
if [ "${DATABASE_URL}" == "mysql://root@mysql/treeherder" ]; then
    # Initialize migrations and SETA
    echo '-----> Running Django migrations and loading reference data'
    ./manage.py migrate --noinput
    ./manage.py load_initial_data
    echo '-----> Initialize SETA'
    ./manage.py initialize_seta
fi

exec "$@"