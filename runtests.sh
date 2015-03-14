#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

echo "Running flake8"
flake8 || { echo "flake8 errors found!"; exit 1; }

echo "Running Python tests"
py.test tests/$* --cov-report html --cov treeherder
