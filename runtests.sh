#!/bin/sh

echo "Checking CELERY_TASK_QUEUES matches Procfile"
./lints/queuelint.py || { exit 1; }

echo "Running flake8"
flake8 || { echo "flake8 errors found!"; exit 1; }

echo "Running isort"
isort --check-only --diff --quiet \
 || { echo "isort errors found! Run 'isort' with no options to fix."; exit 1; }

echo "Running Django system checks"
# See .travis.yml for explanation of the environment variable overriding.
SITE_URL="https://treeherder.dev" TREEHERDER_DEBUG="False" ./manage.py check --deploy --fail-level WARNING || { exit 1; }

echo "Running Python tests"
py.test tests/
