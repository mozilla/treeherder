#!/usr/bin/env bash

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

echo "Running pip check"
pip check

echo "Checking CELERY_TASK_QUEUES matches Procfile"
python -bb ./lints/queuelint.py

echo "Running flake8"
flake8 --show-source || { echo "flake8 errors found!"; exit 1; }

echo "Running isort"
isort --check-only --diff --quiet \
 || { echo "isort errors found! Run 'isort' with no options to fix."; exit 1; }

echo "Running Django system checks"
# See .travis.yml for explanation of the environment variable overriding.
SITE_URL="https://treeherder.dev" TREEHERDER_DEBUG="False" python -bb ./manage.py check --deploy --fail-level WARNING

echo "Running Python tests"
python -bb -m pytest tests/

echo "Running shellcheck"
git grep -El '^#!/.+\b(bash|sh)\b' | xargs shellcheck

echo "Running test docs generation"
mkdocs build

# Restore shell options since this script is sourced, so affects the caller:
# https://github.com/travis-ci/travis-ci/issues/5434
set +euo pipefail