#! /bin/bash -ex

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

# Initialize the basics needed to run treeherder-service.

source /etc/profile.d/treeherder.sh
./manage.py init_master_db --noinput -v 3
./manage.py init_datasources
./docker/generate_test_credentials.py

sleep infinity
