from treeherder.config.settings import *  # noqa: F403

DATABASES["default"]["TEST"] = {"NAME": "test_treeherder"}  # noqa: F405
KEY_PREFIX = 'test'

TREEHERDER_TEST_REPOSITORY_NAME = 'test_treeherder_jobs'

# this makes celery calls synchronous, useful for unit testing
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Make WhiteNoise look for static assets inside registered Django apps, rather
# than only inside the generated staticfiles directory. This means we don't
# have to run collectstatic for `test_content_security_policy_header` to pass.
WHITENOISE_USE_FINDERS = True

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

# For Push Health Usage dashboard
NEW_RELIC_INSIGHTS_API_KEY = "123"
