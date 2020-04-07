#!/usr/bin/env bash

# This script does not need a Docker set up to execute
# You need to run it within a Python virtualenv with the packages
# from common.txt, dev.txt and docs.txt

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

echo "Running pip check"
pip check

echo "Checking CELERY_TASK_QUEUES matches Procfile"
./lints/queuelint.py

echo "Running flake8"
flake8 --show-source || { echo "flake8 errors found!"; exit 1; }

if hash shellcheck 2>/dev/null; then
  echo "Running shellcheck"
  git grep -El '^#!/.+\b(bash|sh)\b' | xargs shellcheck
else
  echo "Not running shellcheck since it is not in the PATH"
fi

echo "Running test docs generation"
mkdocs build
