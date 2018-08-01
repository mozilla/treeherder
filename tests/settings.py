from treeherder.config.settings import *

DATABASES["default"]["TEST"] = {"NAME": "test_treeherder"}
KEY_PREFIX = 'test'

TREEHERDER_TEST_REPOSITORY_NAME = 'test_treeherder_jobs'

# this makes celery calls synchronous, useful for unit testing
CELERY_ALWAYS_EAGER = True
CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

# Reconfigure pulse to operate on default vhost of rabbitmq
PULSE_URL = BROKER_URL
PULSE_EXCHANGE_NAMESPACE = 'test'

# Set a fake api key for testing bug filing
BUGFILER_API_KEY = "12345helloworld"
BUGFILER_API_URL = "https://thisisnotbugzilla.org"

# some of the auth/login tests can be faster if we don't require "django_db"
# access.  But if we use the defaults in config.settings, we also get the
# ``ModelBackend``, which will try to access the DB.  This ensures we don't
# do that, since we don't have any tests that use the ``ModelBackend``.
AUTHENTICATION_BACKENDS = (
    'treeherder.auth.backends.AuthBackend',
)
