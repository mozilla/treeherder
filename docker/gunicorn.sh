#! /bin/bash -ex

source /etc/profile.d/treeherder.sh
./docker/generate_test_credentials.py

# Use exec so pid 1 is now gunicorn instead of bash...
exec gunicorn \
  -w 5 \
  -b 0.0.0.0:8000 \
  --timeout 30 \
  treeherder.config.wsgi:application
