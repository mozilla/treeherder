#!/usr/bin/env bash

# This script does not need a Docker set up to execute
# You need to run it within a Python virtualenv with the packages
# from common.txt, dev.txt and docs.txt

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

echo "Running shellcheck (if availablein PATH)"
if hash shellcheck 2>/dev/null; then
  git grep -El '^#!/.+\b(bash|sh)\b' | xargs shellcheck
fi

echo "Running test docs generation"
mkdocs build
