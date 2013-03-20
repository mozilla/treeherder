import os

TREEHERDER_DATABASE_NAME     = os.environ.get("TREEHERDER_DATABASE_NAME", "")
TREEHERDER_DATABASE_USER     = os.environ.get("TREEHERDER_DATABASE_USER", "")
TREEHERDER_DATABASE_PASSWORD = os.environ.get("TREEHERDER_DATABASE_PASSWORD", "")
TREEHERDER_DATABASE_HOST     = os.environ.get("TREEHERDER_DATABASE_HOST", "localhost")
TREEHERDER_DATABASE_PORT     = os.environ.get("TREEHERDER_DATABASE_PORT", "")

# Applications useful for development, e.g. debug_toolbar, django_extensions.
# Always empty in production
LOCAL_APPS = []

DEBUG = os.environ.get("TREEHERDER_DEBUG") is not None

# Make this unique, and don't share it with anybody.
SECRET_KEY = os.environ.get("TREEHERDER_DJANGO_SECRET_KEY", "")

# Make this unique so that if you execute the tests against a shared database,
# you don't conflict with other people running the tests simultaneously.
TEST_DB_PREFIX = "test_"
