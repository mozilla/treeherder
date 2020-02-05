#!/usr/bin/env bash

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

echo "Running pip check"
pip check

echo "Checking CELERY_TASK_QUEUES matches Procfile"
python ./lints/queuelint.py

echo "Running flake8"
flake8 --show-source || { echo "flake8 errors found!"; exit 1; }

echo "Running isort"
isort --check-only --diff --quiet \
 || { echo "isort errors found! Run 'isort' with no options to fix."; exit 1; }

echo "Running shellcheck"
git grep -El '^#!/.+\b(bash|sh)\b' | xargs shellcheck

echo "Running test docs generation"
mkdocs build

echo "Running Django system checks"
# We can remove these env variables once the default values are properly set:
# https://github.com/mozilla/treeherder/issues/5926
BROKER_URL=localhost//guest:guest@rabbitmq//
DATABASE_URL=mysql://root@localhost:3306/treeherder
REDIS_URL=redis://localhost:6379
SITE_URL=http://backend:8000/
TREEHERDER_DEBUG=True
TREEHERDER_DJANGO_SECRET_KEY=secret-key-of-at-least-50-characters-to-pass-check-deploy
NEW_RELIC_DEVELOPER_MODE=True
# Several security features in settings.py (eg setting HSTS headers) are conditional on
# 'https://' being in the site URL. In addition, we override the test environment's debug
# value so the tests pass. The real environment variable will be checked during deployment.
python ./manage.py check --deploy --fail-level WARNING
