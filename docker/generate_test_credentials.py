#! /usr/bin/env python

# In many cases you want to hit treeherder services but it is difficult
# particularly in tests if you don't know the oauth credentials. This file
# rewrites the credentials for all projects so both user/pass are the same (the
# name of the project).

import subprocess
import os
import json

# Manage target...
TREEHERDER = os.path.join(os.path.dirname(__file__), '..')
MANAGE = os.path.join(TREEHERDER, 'manage.py')
CREDENTIALS = os.path.join(TREEHERDER, 'treeherder', 'etl', 'data', 'credentials.json')

# Create the initial credentials if needed..
subprocess.check_call([MANAGE, 'export_project_credentials'])

# Load and process the json...
content = json.loads(open(CREDENTIALS).read())

for project in content.keys():
    content[project] = {
        "consumer_key":  project,
        "consumer_secret":  project,
    }

with open(CREDENTIALS, 'w') as cred_file:
    cred_file.write(json.dumps(content, indent=4))
