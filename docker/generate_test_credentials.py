#! /usr/bin/env python

# In many cases you want to hit treeherder services but it is difficult
# particularly in tests if you don't know the oauth credentials. This file
# rewrites the credentials for all projects so both user/pass are the same (the
# name of the project).

import json
import os
import subprocess
import time

# Manage target...
TREEHERDER = os.path.join(os.path.dirname(__file__), '..')
MANAGE = os.path.join(TREEHERDER, 'manage.py')
CREDENTIALS = os.path.join(TREEHERDER, 'treeherder', 'etl', 'data', 'credentials.json')

# Maximum times to retry fetching credentials...
RETRIES = 20

# Current retry for fetching credentials...
current_try = 0

# docker-compose/fig only handles races between the start of individual
# containers but not services inside of them... To make it easier to bootstrap
# various projects together we "wait" here for the credentials to be prepared
# prior to starting gunicorn. The expectation is the init.sh script is running
# in another container and will bootstrap various bits.
while current_try < RETRIES:
    current_try = current_try + 1

    # Create the initial credentials if needed..
    exit = subprocess.call([MANAGE, 'export_project_credentials'])

    # This may fail if we have not created the database yet if so we want to do
    # a retry...
    if exit != 0:
        print('Error calling export_project_credentials retrying...')
        time.sleep(2)
        continue

    # Load and process the json...
    with open(CREDENTIALS) as f:
        content = json.loads(f.read())

    print('Projects:', content.keys())

    # It is possible we have a database setup but no fixtures imported if this
    # is the case retry...
    if len(content.keys()) < 1:
        print('No credentials to process waiting ...')
        time.sleep(2)
        continue
    else:
        break

for project in content.keys():
    content[project] = {
        "consumer_key":  project,
        "consumer_secret":  project,
    }

with open(CREDENTIALS, 'w') as cred_file:
    cred_file.write(json.dumps(content, indent=4))
