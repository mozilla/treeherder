#!/usr/bin/env bash
# Make non-zero exit codes & other errors fatal.
set -euo pipefail

echo '-----> Running Django migrations and loading reference data'
./manage.py migrate --noinput
./manage.py load_initial_data

exec "$@"