#!/bin/sh

echo "Checking CELERY_QUEUES matches Procfile"
./lints/queuelint.py || { exit 1; }

echo "Running flake8"
flake8 || { echo "flake8 errors found!"; exit 1; }

echo "Running isort"
isort --check-only --diff --quiet \
 || { echo "isort errors found! Run 'isort' with no options to fix."; exit 1; }

echo "Running Python tests"
py.test tests/
