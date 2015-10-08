import os

# Applications useful for development, e.g. debug_toolbar, django_extensions.
# Always empty in production
LOCAL_APPS = []

DEBUG = os.environ.get("TREEHERDER_DEBUG") is not None

# Set this to True to submit bug associations to Elasticsearch.
MIRROR_CLASSIFICATIONS = False
