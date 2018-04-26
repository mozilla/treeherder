#!/bin/sh

set -ue

mysql -u root -e 'drop database treeherder;'
mysql -u root -e 'create database treeherder;'

python manage.py migrate
