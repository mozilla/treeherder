# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import os

TREEHERDER_DATABASE_NAME     = os.environ.get("TREEHERDER_DATABASE_NAME", "")
TREEHERDER_DATABASE_USER     = os.environ.get("TREEHERDER_DATABASE_USER", "")
TREEHERDER_DATABASE_PASSWORD = os.environ.get("TREEHERDER_DATABASE_PASSWORD", "")
TREEHERDER_DATABASE_HOST     = os.environ.get("TREEHERDER_DATABASE_HOST", "localhost")
TREEHERDER_DATABASE_PORT     = os.environ.get("TREEHERDER_DATABASE_PORT", "")

TREEHERDER_MEMCACHED = os.environ.get("TREEHERDER_MEMCACHED", "")
TREEHERDER_MEMCACHED_KEY_PREFIX = os.environ.get("TREEHERDER_MEMCACHED_KEY_PREFIX", "treeherder")

# Applications useful for development, e.g. debug_toolbar, django_extensions.
# Always empty in production
LOCAL_APPS = ["rest_framework_swagger"]

DEBUG = os.environ.get("TREEHERDER_DEBUG") is not None

# Make this unique, and don't share it with anybody.
SECRET_KEY = os.environ.get("TREEHERDER_DJANGO_SECRET_KEY", "")

# Make this unique so that if you execute the tests against a shared database,
# you don't conflict with other people running the tests simultaneously.
TEST_DB_PREFIX = ""

SITE_URL = "http://local.treeherder.mozilla.org"

# Set this to True to submit bug associations to Bugzilla & OrangeFactor.
TBPL_BUGS_TRANSFER_ENABLED = False

# TBPLBOT is the Bugzilla account used to make the bug comments on
# intermittent failure bugs when failures are classified.
TBPLBOT_EMAIL = os.environ.get("TBPLBOT_EMAIL", "")
TBPLBOT_PASSWORD = os.environ.get("TBPLBOT_PASSWORD", "")

TREEHERDER_RO_DATABASE_USER     = os.environ.get("TREEHERDER_RO_DATABASE_USER", "TREEHERDER_DATABASE_USER")
TREEHERDER_RO_DATABASE_PASSWORD = os.environ.get("TREEHERDER_RO_DATABASE_PASSWORD", "TREEHERDER_DATABASE_PASSWORD")

TREEHERDER_REQUEST_PROTOCOL = os.environ.get("TREEHERDER_REQUEST_PROTOCOL", "http")
TREEHERDER_REQUEST_HOST = os.environ.get("TREEHERDER_REQUEST_HOST", "local.treeherder.mozilla.org")

PULSE_USERNAME = os.environ.get("PULSE_USERNAME", "")
PULSE_PASSWORD = os.environ.get("PULSE_PASSWORD", "")
