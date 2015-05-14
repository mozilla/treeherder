#! /bin/bash -ex

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

source /etc/profile.d/treeherder.sh
./docker/generate_test_credentials.py

# Use exec so pid 1 is now gunicon instead of bash...
exec gunicorn \
  -w 5 \
  -b 0.0.0.0:8000 \
  --timeout 120 \
  treeherder.webapp.wsgi:application
