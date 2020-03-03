import platform
import re
from datetime import timedelta
from os.path import (abspath,
                     dirname,
                     join)

import environ
from furl import furl
from kombu import (Exchange,
                   Queue)

from treeherder.config.utils import (connection_should_use_tls,
                                     get_tls_redis_url)

# TODO: Switch to pathlib once using Python 3.
SRC_DIR = dirname(dirname(dirname(abspath(__file__))))

env = environ.Env()

# Checking for OS type
IS_WINDOWS = "windows" in platform.system().lower()

# Top Level configuration
DEBUG = env.bool("TREEHERDER_DEBUG", default=False)

NEW_RELIC_DEVELOPER_MODE = env.bool("NEW_RELIC_DEVELOPER_MODE", default=True if DEBUG else False)

# Papertrail logs WARNING messages. This env variable allows modifying the behaviour
LOGGING_LEVEL = env.str("LOGGING_LEVEL", default='INFO')

GRAPHQL = env.bool("GRAPHQL", default=True)

# Make this unique, and don't share it with anybody.
SECRET_KEY = env("TREEHERDER_DJANGO_SECRET_KEY", default='secret-key-of-at-least-50-characters-to-pass-check-deploy')

# Hosts
SITE_URL = env("SITE_URL", default='http://localhost:8000')
if env("HEROKU_REVIEW_APP", default=False):
    # This is to support Heroku Review apps which host is different for each PR
    SITE_URL = "https://{}.herokuapp.com".format(env("HEROKU_APP_NAME"))

SITE_HOSTNAME = furl(SITE_URL).host
# Including localhost allows using the backend locally
ALLOWED_HOSTS = [SITE_HOSTNAME, 'localhost']

# URL handling
APPEND_SLASH = False
ROOT_URLCONF = "treeherder.config.urls"
WSGI_APPLICATION = 'treeherder.config.wsgi.application'

# Send full URL within origin but only origin for cross-origin requests
SECURE_REFERRER_POLICY = "origin-when-cross-origin"

# We can't set X_FRAME_OPTIONS to DENY since renewal of an Auth0 token
# requires opening the auth handler page in an invisible iframe with the
# same origin.
X_FRAME_OPTIONS = 'SAMEORIGIN'

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
    'treeherder.extract',
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
LOCALHOST_MYSQL_HOST = 'mysql://root@{}:3306/treeherder'.format('localhost' if IS_WINDOWS else '127.0.0.1')
DATABASES = {
    'default': env.db_url('DATABASE_URL', default=LOCALHOST_MYSQL_HOST),
}

# Only used when syncing local database with production replicas
UPSTREAM_DATABASE_URL = env('UPSTREAM_DATABASE_URL', default=None)
if UPSTREAM_DATABASE_URL:
    DATABASES['upstream'] = env.db_url_config(UPSTREAM_DATABASE_URL)

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
        # From MySQL 5.7 onwards and on fresh installs of MySQL 5.6, the default value of the sql_mode
        # option contains STRICT_TRANS_TABLES. That option escalates warnings into errors when data are
        # truncated upon insertion, so Django highly recommends activating a strict mode for MySQL to
        # prevent data loss (either STRICT_TRANS_TABLES or STRICT_ALL_TABLES).
        'init_command': "SET sql_mode='STRICT_TRANS_TABLES'"
    }
    if connection_should_use_tls(DATABASES[alias]['HOST']):
        # Use TLS when connecting to RDS.
        # https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html#MySQL.Concepts.SSLSupport
        # https://mysqlclient.readthedocs.io/user_guide.html#functions-and-attributes
        DATABASES[alias]['OPTIONS']['ssl'] = {
            'ca': 'deployment/aws/rds-combined-ca-bundle.pem',
        }

# Caches
REDIS_URL = env('REDIS_URL', default='redis://localhost:6379')
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
STATIC_ROOT = join(SRC_DIR, ".django-static")
STATIC_URL = "/static/"

# Create hashed+gzipped versions of assets during collectstatic,
# which will then be served by WhiteNoise with a suitable max-age.
# http://whitenoise.evans.io/en/stable/django.html#add-compression-and-caching-support
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
        'treeherder': {
            'handlers': ['console'],
            'level': LOGGING_LEVEL,
            'propagate': LOGGING_LEVEL != 'WARNING',
        },
        'kombu': {
            'handlers': ['console'],
            'level': 'WARNING',
        },
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
    'security.W019'
]

# User Agents
# User agents which will be blocked from making requests to the site.
DISALLOWED_USER_AGENTS = (
    re.compile(r'^Go-http-client/'),
    # This was the old Go http package user agent prior to Go-http-client/*
    # https://github.com/golang/go/commit/0d1ceef9452c495b6f6d60e578886689184e5e4b
    re.compile(r'^Go 1.1 package http'),
    # Note: This intentionally does not match the command line curl
    # tool's default User Agent, only the library used by eg PHP.
    re.compile(r'^libcurl/'),
    re.compile(r'^Python-urllib/'),
    re.compile(r'^python-requests/'),
)


# THIRD PARTY APPS

# Auth0 setup
AUTH0_DOMAIN = env('AUTH0_DOMAIN', default="auth.mozilla.auth0.com")
AUTH0_CLIENTID = env('AUTH0_CLIENTID', default="q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z")

# Celery

# TODO: Replace the use of different log parser queues for failures vs not with the
# RabbitMQ priority feature (since the idea behind separate queues was only to ensure
# failures are dealt with first if there is a backlog). After that it should be possible
# to simplify the queue configuration, by using the recommended CELERY_TASK_ROUTES instead:
# http://docs.celeryproject.org/en/latest/userguide/routing.html#automatic-routing
CELERY_TASK_QUEUES = [
    Queue('default', Exchange('default'), routing_key='default'),
    Queue('log_parser', Exchange('default'), routing_key='log_parser.normal'),
    Queue('log_parser_fail', Exchange('default'), routing_key='log_parser.failures'),
    Queue('log_autoclassify', Exchange('default'), routing_key='autoclassify.normal'),
    Queue('log_autoclassify_fail', Exchange('default'), routing_key='autoclassify.failures'),
    Queue('pushlog', Exchange('default'), routing_key='pushlog'),
    Queue('generate_perf_alerts', Exchange('default'), routing_key='generate_perf_alerts'),
    Queue('store_pulse_tasks', Exchange('default'), routing_key='store_pulse_tasks'),
    Queue('store_pulse_pushes', Exchange('default'), routing_key='store_pulse_pushes'),
    Queue('seta_analyze_failures', Exchange('default'), routing_key='seta_analyze_failures'),
]

# Force all queues to be explicitly listed in `CELERY_TASK_QUEUES` to help prevent typos
# and so that `lints/queuelint.py` can check a corresponding worker exists in `Procfile`.
CELERY_TASK_CREATE_MISSING_QUEUES = False

# Celery broker setup
CELERY_BROKER_URL = env('BROKER_URL', default='amqp://guest:guest@localhost:5672//')

# Force Celery to use TLS when appropriate (ie if not localhost),
# rather than relying on `CELERY_BROKER_URL` having `amqps://` or `?ssl=` set.
# This is required since CloudAMQP's automatically defined URL uses neither.
if connection_should_use_tls(CELERY_BROKER_URL):
    CELERY_BROKER_USE_SSL = True

# Recommended by CloudAMQP:
# https://www.cloudamqp.com/docs/celery.html
# Raise timeout from default of 4s, in case of Linux DNS timeouts etc.
CELERY_BROKER_CONNECTION_TIMEOUT = 30
# Disable heartbeats since CloudAMQP uses TCP keep-alive instead.
CELERY_BROKER_HEARTBEAT = None

# default value when no task routing info is specified
CELERY_TASK_DEFAULT_QUEUE = 'default'

# Make Celery defer the acknowledgment of a task until after the task has completed,
# to prevent data loss in the case of celery master process crashes or infra failures.
# https://devcenter.heroku.com/articles/celery-heroku#using-acks_late
# http://docs.celeryproject.org/en/latest/userguide/tasks.html#Task.acks_late
CELERY_TASK_ACKS_LATE = True

# Default celery time limits in seconds. The gap between the soft and hard time limit
# is to give the New Relic agent time to report the `SoftTimeLimitExceeded` exception.
# NB: The per-task `soft_time_limit` must always be lower than `CELERY_TASK_TIME_LIMIT`.
CELERY_TASK_SOFT_TIME_LIMIT = 15 * 60
CELERY_TASK_TIME_LIMIT = CELERY_TASK_SOFT_TIME_LIMIT + 30

CELERY_BEAT_SCHEDULE = {
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
}

# CORS Headers
CORS_ORIGIN_ALLOW_ALL = True  # allow requests from any host

# Debug Toolbar
if DEBUG:
    # This controls wether the Django debug toolbar should be shown or not
    # https://django-debug-toolbar.readthedocs.io/en/latest/configuration.html#show-toolbar-callback
    # "You can provide your own function callback(request) which returns True or False."
    DEBUG_TOOLBAR_CONFIG = {
        'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,
    }

    INSTALLED_APPS.append('debug_toolbar')


# Rest Framework
REST_FRAMEWORK = {
    'ALLOWED_VERSIONS': ('1.0',),
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework.authentication.SessionAuthentication',),
    'DEFAULT_FILTER_BACKENDS': ('django_filters.rest_framework.DjangoFilterBackend',),
    'DEFAULT_PARSER_CLASSES': ('rest_framework.parsers.JSONParser',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticatedOrReadOnly',),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'DEFAULT_SCHEMA_CLASS': 'rest_framework.schemas.coreapi.AutoSchema',
    'DEFAULT_VERSION': '1.0',
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.AcceptHeaderVersioning',
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}

# Whitenoise
# http://whitenoise.evans.io/en/stable/django.html#available-settings
# Files in this directory will be served by WhiteNoise at the site root.
WHITENOISE_ROOT = join(SRC_DIR, ".build")
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

# Performance sheriff bot settings
MAX_BACKFILLS_PER_PLATFORM = {
    'linux': 200,
}
RESET_BACKFILL_LIMITS = timedelta(hours=24)

# Resource count to limit the number of threads opening connections with the DB
CONN_RESOURCES = 50
