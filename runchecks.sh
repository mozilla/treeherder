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
# Several security features in settings.py (eg setting HSTS headers) are conditional on
# 'https://' being in the site URL. In addition, we override the test environment's debug
# value so the tests pass. The real environment variable will be checked during deployment.
SITE_URL="https://treeherder.dev" TREEHERDER_DEBUG="False" python ./manage.py check --deploy --fail-level WARNING
