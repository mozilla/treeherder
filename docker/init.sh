#! /bin/bash -ex

# Initialize the basics needed to run treeherder-service.

source /etc/profile.d/treeherder.sh
./manage.py migrate --noinput
./manage.py load_initial_data
./manage.py init_datasources
# TODO: Replace this step with Hawk equivalent (see puppet 'create_etl_credentials' task).
# ./docker/generate_test_credentials.py
# eg:
# ./manage.py createsuperuser --username treeherder-docker --email treeherder-docker@mozilla.bugs --noinput
# ./manage.py create_credentials treeherder-docker treeherder-docker@mozilla.bugs "Docker credentials"
# However this script gets run every time I think? If so, they need to be conditional.
# Also what actually uses the docker project? This affects what credentials we set up.
# If it doesn't have an owner or isn't used at the moment, should we just remove it for now?

sleep infinity
