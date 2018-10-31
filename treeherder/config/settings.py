from __future__ import unicode_literals

import os
import re
from datetime import timedelta

import environ
from celery.schedules import crontab
from furl import furl
from kombu import (Exchange,
                   Queue)

from treeherder.config.utils import (connection_should_use_tls,
                                     get_tls_redis_url)

PROJECT_DIR = os.path.dirname(os.path.abspath(os.path.dirname(__file__)))

env = environ.Env()

# Top Level configuration
DEBUG = env.bool("TREEHERDER_DEBUG", default=False)

GRAPHQL = env.bool("GRAPHQL", default=True)

# Make this unique, and don't share it with anybody.
SECRET_KEY = env("TREEHERDER_DJANGO_SECRET_KEY")

# Hosts
SITE_URL = env("SITE_URL", default="http://localhost:8000/")
SITE_HOSTNAME = furl(SITE_URL).host
ALLOWED_HOSTS = [SITE_HOSTNAME]

# URL handling
APPEND_SLASH = False
ROOT_URLCONF = "treeherder.config.urls"
WSGI_APPLICATION = 'treeherder.config.wsgi.application'

# Application definition
INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    # Disable Django's own staticfiles handling in favour of WhiteNoise, for
    # greater consistency between gunicorn and `./manage.py runserver`.
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',

    # 3rd party apps
    'rest_framework',
    'corsheaders',
    'django_filters',
    'graphene_django',

    # treeherder apps
    'treeherder.model',
    'treeherder.webapp',
    'treeherder.log_parser',
    'treeherder.etl',
    'treeherder.perf',
    'treeherder.autoclassify',
    'treeherder.seta',
    'treeherder.intermittents_commenter',
]
if DEBUG:
    INSTALLED_APPS.append('django_extensions')

# Middleware
MIDDLEWARE = [middleware for middleware in [
    # Adds custom New Relic annotations. Must be first so all transactions are annotated.
    'treeherder.middleware.NewRelicMiddleware',
    # Redirect to HTTPS/set HSTS and other security headers.
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    # Allows both Django static files and those specified via `WHITENOISE_ROOT`
    # to be served by WhiteNoise, avoiding the need for Apache/nginx on Heroku.
    'treeherder.middleware.CustomWhiteNoise',
    'django.middleware.gzip.GZipMiddleware',
    'debug_toolbar.middleware.DebugToolbarMiddleware' if DEBUG else False,
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
] if middleware]

# Templating
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'APP_DIRS': True,
}]

# Database
# The database config is defined using environment variables of form:
#
#   'mysql://username:password@host:optional_port/database_name'
#
# which django-environ converts into the Django DB settings dict format.
DATABASES = {
    'default': env.db_url('DATABASE_URL'),
}

# We're intentionally not using django-environ's query string options feature,
# since it hides configuration outside of the repository, plus could lead to
# drift between environments.
for alias in DATABASES:
    # Persist database connections for 5 minutes, to avoid expensive reconnects.
    DATABASES[alias]['CONN_MAX_AGE'] = 300
    DATABASES[alias]['OPTIONS'] = {
        # Override Django's default connection charset of 'utf8', otherwise it's
        # still not possible to insert non-BMP unicode into utf8mb4 tables.
        'charset': 'utf8mb4',
    }
    if DATABASES[alias]['HOST'] != 'localhost':
        # Use TLS when connecting to RDS.
        DATABASES[alias]['OPTIONS']['ssl'] = {
            'ca': 'deployment/aws/combined-ca-bundle.pem',
        }

# Caches
REDIS_URL = env('REDIS_URL')
if connection_should_use_tls(REDIS_URL):
    # Connect using TLS on Heroku.
    REDIS_URL = get_tls_redis_url(REDIS_URL)

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            # Override the default of no timeout, to avoid connection hangs.
            'SOCKET_CONNECT_TIMEOUT': 5,
        },
    },
}

# Internationalization
TIME_ZONE = "UTC"
USE_I18N = False
USE_L10N = True

# Static files (CSS, JavaScript, Images)
STATIC_ROOT = os.path.join(PROJECT_DIR, "static")
STATIC_URL = "/static/"

# Create hashed+gzipped versions of assets during collectstatic,
# which will then be served by WhiteNoise with a suitable max-age.
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Authentication
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'treeherder.auth.backends.AuthBackend',
]

# Use the cache-based backend rather than the default of database.
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'

# Path to redirect to on successful login.
LOGIN_REDIRECT_URL = '/'

# Path to redirect to on unsuccessful login attempt.
LOGIN_REDIRECT_URL_FAILURE = '/'

# Path to redirect to on logout.
LOGOUT_REDIRECT_URL = '/'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'formatters': {
        'standard': {
            'format': "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] %(message)s",
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard'
        },
    },
    'loggers': {
        'django': {
            'filters': ['require_debug_true'],
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': True,
        },
        'elasticsearch.trace': {
            'filters': ['require_debug_true'],
            'handlers': ['console'],
            'level': 'INFO',
        },
        'treeherder': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'WARNING',
            'propagate': not DEBUG,
        },
        'kombu': {
            'handlers': ['console'],
            'level': 'WARNING',
        }
    }
}

# SECURITY
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if SITE_URL.startswith('https://'):
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_HSTS_SECONDS = int(timedelta(days=365).total_seconds())
    # Mark session and CSRF cookies as being HTTPS-only.
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True

SECURE_CONTENT_TYPE_NOSNIFF = True  # Set the `X-Content-Type-Options` header to `nosniff`.
SECURE_BROWSER_XSS_FILTER = True  # Sets the `X-XSS-Protection` header.

# System Checks
SILENCED_SYSTEM_CHECKS = [
    # We can't set CSRF_COOKIE_HTTPONLY to True since the requests to the API
    # made using Angular's `httpProvider` require access to the cookie.
    'security.W017',
    # We can't set X_FRAME_OPTIONS to DENY since renewal of an Auth0 token
    # requires opening the auth handler page in an invisible iframe with the
    # same origin.  This is the default setting ('SAMEORIGIN') for Django's
    # X_FRAME_OPTIONS setting so it isn't set in this file.
    'security.W019'
]

# User Agents
# User agents which will be blocked from making requests to the site.
DISALLOWED_USER_AGENTS = (
    # Note: This intentionally does not match the command line curl
    # tool's default User Agent, only the library used by eg PHP.
    re.compile(r'^libcurl/'),
    re.compile(r'^Python-urllib/'),
    re.compile(r'^python-requests/'),
    # ActiveData blocked for excessive API requests (bug 1289830)
    re.compile(r'^ActiveData-ETL'),
)


# THIRD PARTY APPS

# Auth0 setup
AUTH0_DOMAIN = env('AUTH0_DOMAIN', default="auth.mozilla.auth0.com")
AUTH0_CLIENTID = env('AUTH0_CLIENTID', default="q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z")

# Celery
CELERY_QUEUES = [
    Queue('default', Exchange('default'), routing_key='default'),
    # queue for failed jobs/logs
    Queue('log_parser', Exchange('default'), routing_key='log_parser.normal'),
    Queue('log_parser_fail', Exchange('default'), routing_key='log_parser.failures'),
    Queue('log_store_failure_lines', Exchange('default'), routing_key='store_failure_lines.normal'),
    Queue('log_store_failure_lines_fail', Exchange('default'), routing_key='store_failure_lines.failures'),
    Queue('log_crossreference_error_lines', Exchange('default'),
          routing_key='crossreference_error_lines.normal'),
    Queue('log_crossreference_error_lines_fail', Exchange('default'),
          routing_key='crossreference_error_lines.failures'),
    Queue('log_autoclassify', Exchange('default'), routing_key='autoclassify.normal'),
    Queue('log_autoclassify_fail', Exchange('default'), routing_key='autoclassify.failures'),
    Queue('pushlog', Exchange('default'), routing_key='pushlog'),
    Queue('generate_perf_alerts', Exchange('default'), routing_key='generate_perf_alerts'),
    Queue('store_pulse_jobs', Exchange('default'), routing_key='store_pulse_jobs'),
    Queue('store_pulse_resultsets', Exchange('default'), routing_key='store_pulse_resultsets'),
    Queue('seta_analyze_failures', Exchange('default'), routing_key='seta_analyze_failures'),
    Queue('intermittents_commenter', Exchange('default'), routing_key='intermittents_commenter'),
]

# Celery broker setup
BROKER_URL = env('BROKER_URL')

# Force Celery to use TLS when appropriate (ie if not localhost),
# rather than relying on `BROKER_URL` having `amqps://` or `?ssl=` set.
# This is required since CloudAMQP's automatically defined URL uses neither.
if connection_should_use_tls(BROKER_URL):
    BROKER_USE_SSL = True

# Recommended by CloudAMQP:
# https://www.cloudamqp.com/docs/celery.html
BROKER_CONNECTION_TIMEOUT = 30
BROKER_HEARTBEAT = None
CELERY_ACCEPT_CONTENT = ['json']
CELERY_EVENT_QUEUE_EXPIRES = 60
CELERY_IGNORE_RESULT = True
CELERY_RESULT_BACKEND = None
CELERY_RESULT_SERIALIZER = 'json'
CELERY_SEND_EVENTS = False
CELERY_TASK_SERIALIZER = 'json'

# default value when no task routing info is specified
CELERY_DEFAULT_QUEUE = 'default'
CELERY_DEFAULT_EXCHANGE_TYPE = 'direct'
CELERY_DEFAULT_ROUTING_KEY = 'default'

# Default celery time limits in seconds. The gap between the soft and hard time limit
# is to give the New Relic agent time to report the `SoftTimeLimitExceeded` exception.
# NB: The per-task `soft_time_limit` must always be lower than `CELERYD_TASK_TIME_LIMIT`.
CELERYD_TASK_SOFT_TIME_LIMIT = 15 * 60
CELERYD_TASK_TIME_LIMIT = CELERYD_TASK_SOFT_TIME_LIMIT + 30

CELERYBEAT_SCHEDULE = {
    # this is just a failsafe in case the Pulse ingestion misses something
    'fetch-push-logs-every-5-minutes': {
        'task': 'fetch-push-logs',
        'schedule': timedelta(minutes=5),
        'relative': True,
        'options': {
            "queue": "pushlog"
        }
    },
    'seta-analyze-failures': {
        'task': 'seta-analyze-failures',
        'schedule': timedelta(days=1),
        'relative': True,
        'options': {
            'queue': "seta_analyze_failures"
        }
    },
    'daily-intermittents-commenter': {
        # Executes every morning at 6 a.m. UTC except monday
        'task': 'intermittents-commenter',
        'schedule': crontab(minute=0, hour=6, day_of_week='tuesday-sunday'),
        'options': {
            'queue': 'intermittents_commenter'
        },
    },
    'weekly-intermittents-commenter': {
        # Executes every monday morning at 7 a.m. UTC
        'task': 'intermittents-commenter',
        'schedule': crontab(minute=0, hour=7, day_of_week='monday'),
        'kwargs': {'weekly_mode': True},
        'options': {
            'queue': 'intermittents_commenter'
        },
    },
}

# CORS Headers
CORS_ORIGIN_ALLOW_ALL = True  # allow requests from any host

# Debug Toolbar
if DEBUG:
    # django-debug-toolbar requires that not only DEBUG be set, but that the request IP
    # be in Django's INTERNAL_IPS setting. When using Vagrant, requests don't come from localhost:
    # http://blog.joshcrompton.com/2014/01/how-to-make-django-debug-toolbar-display-when-using-vagrant/
    # If the Vagrant IPs vary by platform or if there isn't a consistent IP when we switch to Docker,
    # we'll have to do: https://github.com/jazzband/django-debug-toolbar/pull/805#issuecomment-240976813
    INTERNAL_IPS = ['127.0.0.1', '10.0.2.2']

    INSTALLED_APPS.append('debug_toolbar')

# Elasticsearch
ELASTICSEARCH_URL = env.str('ELASTICSEARCH_URL', default='')

# Rest Framework
REST_FRAMEWORK = {
    'ALLOWED_VERSIONS': ('1.0',),
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework.authentication.SessionAuthentication',),
    'DEFAULT_FILTER_BACKENDS': ('rest_framework_filters.backends.DjangoFilterBackend',),
    'DEFAULT_PARSER_CLASSES': ('rest_framework.parsers.JSONParser',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticatedOrReadOnly',),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'DEFAULT_VERSION': '1.0',
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.AcceptHeaderVersioning',
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}

# Whitenoise
# Files in this directory will be served by WhiteNoise at the site root.
WHITENOISE_ROOT = os.path.join(PROJECT_DIR, "..", "build")
# Serve index.html for URLs ending in a trailing slash.
WHITENOISE_INDEX_FILE = True
# Only output the hashed filename version of static files and not the originals.
# Halves the time spent performing Brotli/gzip compression during deploys.
WHITENOISE_KEEP_ONLY_HASHED_FILES = True


# TREEHERDER

# Bugzilla
# BZ_API_URL is used to fetch bug suggestions from bugzilla
# BUGFILER_API_URL is used when filing bugs
# these are no longer necessarily the same so stage treeherder can submit
# to stage bmo, while suggestions can still be fetched from prod bmo
BZ_API_URL = "https://bugzilla.mozilla.org"
BUGFILER_API_URL = env("BUGZILLA_API_URL", default=BZ_API_URL)
BUGFILER_API_KEY = env("BUG_FILER_API_KEY", default=None)

# For intermittents commenter
COMMENTER_API_KEY = env("BUG_COMMENTER_API_KEY", default=None)

# Log Parsing
PARSER_MAX_STEP_ERROR_LINES = 100
FAILURE_LINES_CUTOFF = 35

# Perfherder
# Default minimum regression threshold for perfherder is 2% (otherwise
# e.g. the build size tests will alert on every commit)
PERFHERDER_REGRESSION_THRESHOLD = 2

# Various settings for treeherder's t-test "sliding window" alert algorithm
PERFHERDER_ALERTS_MIN_BACK_WINDOW = 12
PERFHERDER_ALERTS_MAX_BACK_WINDOW = 24
PERFHERDER_ALERTS_FORE_WINDOW = 12

# Only generate alerts for data newer than this time in seconds in perfherder
PERFHERDER_ALERTS_MAX_AGE = timedelta(weeks=2)
