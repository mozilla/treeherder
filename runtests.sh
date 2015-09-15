#!/bin/sh

echo "Running flake8"
flake8 || { echo "flake8 errors found!"; exit 1; }

echo "Running Python tests"
DJANGO_SETTINGS_MODULE=tests.settings py.test tests/$* --cov-report html --cov treeherder
