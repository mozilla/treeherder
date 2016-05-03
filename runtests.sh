#!/bin/sh

echo "Checking CELERY_QUEUES matches Procfile"
./lints/queuelint.py || { exit 1; }

echo "Running flake8"
flake8 || { echo "flake8 errors found!"; exit 1; }

echo "Running isort"
isort --check-only --diff --quiet \
 || { echo "isort errors found! Run 'isort' with no options to fix."; exit 1; }

echo "Running Django system checks"
# See .travis.yml for explanation of the environment variable overriding.
# Replace awk with `--fail-level WARNING` once we're using Django 1.10, since in
# previous versions an exit code of 1 is hard-coded to only ERROR and above:
# https://github.com/django/django/commit/287532588941d2941e19c4cd069bcbd8af889203
SITE_URL="https://treeherder.dev" TREEHERDER_DEBUG="False" ./manage.py check --deploy 2>&1 \
 | awk '/^WARNINGS/{err=1} {print} END{exit err}' || { exit 1; }

echo "Running Python tests"
py.test tests/
