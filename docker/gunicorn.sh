#! /bin/bash -ex
source /etc/profile.d/treeherder.sh
gunicorn \
  -w 5 \
  -b 0.0.0.0:8000 \
  --timeout 120 \
  treeherder.webapp.wsgi:application
