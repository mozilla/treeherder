# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import os

# Applications useful for development, e.g. debug_toolbar, django_extensions.
# Always empty in production
LOCAL_APPS = ["rest_framework_swagger"]

DEBUG = os.environ.get("TREEHERDER_DEBUG") is not None

# Set this to True to submit bug associations to Bugzilla & Elasticsearch.
MIRROR_CLASSIFICATIONS = False
