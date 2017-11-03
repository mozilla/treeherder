#!/usr/bin/env bash

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

echo "Running pip check"
pip check

echo "Checking CELERY_QUEUES matches Procfile"
./lints/queuelint.py

echo "Running flake8"
flake8 || { echo "flake8 errors found!"; exit 1; }

echo "Running isort"
isort --check-only --diff --quiet \
 || { echo "isort errors found! Run 'isort' with no options to fix."; exit 1; }

echo "Running Django system checks"
# See .travis.yml for explanation of the environment variable overriding.
SITE_URL="https://treeherder.dev" TREEHERDER_DEBUG="False" ./manage.py check --deploy --fail-level WARNING

echo "Running Python tests"
py.test tests/
