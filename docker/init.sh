#! /bin/bash -ex

# Initialize the basics needed to run treeherder-service.

source /etc/profile.d/treeherder.sh
./manage.py init_master_db --noinput -v 3
./manage.py init_datasources
./docker/generate_test_credentials.py

sleep infinity
