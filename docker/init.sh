#! /bin/bash -ex

# Initialize the basics needed to run treeherder-service.

source /etc/profile.d/treeherder.sh
./manage.py migrate
./manage.py load_initial_data
./manage.py init_datasources
./docker/generate_test_credentials.py

sleep infinity
