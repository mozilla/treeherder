# Django settings for webapp project.
import os
from datetime import timedelta

import dj_database_url
from kombu import Exchange, Queue

from treeherder import path

# These settings can all be optionally set via env vars, or in local.py:

TREEHERDER_MEMCACHED = os.environ.get("TREEHERDER_MEMCACHED", "127.0.0.1:11211")
TREEHERDER_MEMCACHED_KEY_PREFIX = os.environ.get("TREEHERDER_MEMCACHED_KEY_PREFIX", "treeherder")

DEBUG = os.environ.get("TREEHERDER_DEBUG", False)

TREEHERDER_REQUEST_PROTOCOL = os.environ.get("TREEHERDER_REQUEST_PROTOCOL", "http")
TREEHERDER_REQUEST_HOST = os.environ.get("TREEHERDER_REQUEST_HOST", "local.treeherder.mozilla.org")

DATA_CYCLE_INTERVAL = timedelta(days=30 * 4)

RABBITMQ_USER = os.environ.get("TREEHERDER_RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.environ.get("TREEHERDER_RABBITMQ_PASSWORD", "guest")
RABBITMQ_VHOST = os.environ.get("TREEHERDER_RABBITMQ_VHOST", "/")
RABBITMQ_HOST = os.environ.get("TREEHERDER_RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = os.environ.get("TREEHERDER_RABBITMQ_PORT", "5672")

# Make this unique, and don't share it with anybody.
SECRET_KEY = os.environ.get("TREEHERDER_DJANGO_SECRET_KEY")

SITE_ID = 1
ROOT_URLCONF = "treeherder.webapp.urls"
WSGI_APPLICATION = 'treeherder.webapp.wsgi.application'

TIME_ZONE = "America/Los_Angeles"
USE_I18N = False
USE_L10N = True

SERVE_MINIFIED_UI = os.environ.get("SERVE_MINIFIED_UI") == "True"
WHITENOISE_ROOT = path("..", "dist" if SERVE_MINIFIED_UI else "ui")

STATIC_ROOT = path("static")
STATIC_URL = "/static/"

MEDIA_ROOT = path("media")
MEDIA_URL = "/media/"

# Create hashed+gzipped versions of assets during collectstatic,
# which will then be served by WhiteNoise with a suitable max-age.
STATICFILES_STORAGE = 'whitenoise.django.GzipManifestStaticFilesStorage'

TEMPLATE_LOADERS = [
    "django.template.loaders.filesystem.Loader",
    "django.template.loaders.app_directories.Loader",
    "django.template.loaders.eggs.Loader",
]
TEMPLATE_DIRS = [
    path("webapp", "templates")
]

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.contrib.auth.context_processors.auth',
    'django.contrib.messages.context_processors.messages'
)

MIDDLEWARE_CLASSES = [
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    # Uncomment the next line for simple clickjacking protection:
    # 'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
    'django_browserid.auth.BrowserIDBackend',
)

# this tells browserid to not create users.
# a user must be created first in the admin
# and then can be recognized with persona login
BROWSERID_CREATE_USER = True

# Path to redirect to on successful login.
LOGIN_REDIRECT_URL = '/'

# Path to redirect to on unsuccessful login attempt.
LOGIN_REDIRECT_URL_FAILURE = '/'

# Path to redirect to on logout.
LOGOUT_REDIRECT_URL = '/'

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.admin',
    # 3rd party apps
    'rest_framework',
    'rest_framework_extensions',
    'rest_framework_swagger',
    'corsheaders',
    'django_browserid',
    # treeherder apps
    'treeherder.model',
    'treeherder.webapp',
    'treeherder.log_parser',
    'treeherder.etl',
    'treeherder.workers',
    'treeherder.embed',
    'treeherder.perf',
    'treeherder.application',
]

LOCAL_APPS = []

# A sample logging configuration. The only tangible logging
# performed by this configuration is to send an email to
# the site admins on every HTTP 500 error.
# See http://docs.djangoproject.com/en/dev/topics/logging for
# more details on how to customize your logging configuration.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] %(message)s",
        },
    },
    'handlers': {
        'console': {
            'level': 'ERROR',
            'class': 'logging.StreamHandler',
            'formatter': 'standard'
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': True,
        },
        'treeherder': {
            'handlers': ['console']
        }
    }
}

CELERY_QUEUES = (
    Queue('default', Exchange('default'), routing_key='default'),
    # queue for failed jobs/logs
    Queue('log_parser_fail', Exchange('default'), routing_key='parse_log.failures'),
    # queue for successful jobs/logs
    Queue('log_parser', Exchange('default'), routing_key='parse_log.success'),
    # this is used to give priority to some logs, for example when we need to
    # parse a log on demand
    Queue('log_parser_hp', Exchange('default'), routing_key='parse_log.high_priority'),
    Queue('log_parser_json', Exchange('default'), routing_key='parse_log.json'),
    Queue('store_error_summary', Exchange('default'), routing_key='store_error_summary'),
    # Queue for mirroring the failure classification activity to Bugzilla/Elasticsearch
    Queue('classification_mirroring', Exchange('default'), routing_key='classification_mirroring'),
    Queue('error_summary', Exchange('default'), routing_key='error_summary'),
    Queue('publish_to_pulse', Exchange('default'), routing_key='publish_to_pulse'),
    Queue('pushlog', Exchange('default'), routing_key='pushlog'),
    Queue('fetch_missing_push_logs', Exchange('default'), routing_key='fetch_missing_push_logs'),
    Queue('buildapi_pending', Exchange('default'), routing_key='buildapi_pending'),
    Queue('buildapi_running', Exchange('default'), routing_key='buildapi_running'),
    Queue('buildapi_4hr', Exchange('default'), routing_key='buildapi_4hr'),
    Queue('cycle_data', Exchange('default'), routing_key='cycle_data'),
    Queue('calculate_eta', Exchange('default'), routing_key='calculate_eta'),
    Queue('fetch_bugs', Exchange('default'), routing_key='fetch_bugs')
)

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# default value when no task routing info is specified
CELERY_DEFAULT_QUEUE = 'default'
CELERY_DEFAULT_EXCHANGE_TYPE = 'direct'
CELERY_DEFAULT_ROUTING_KEY = 'default'

CELERYBEAT_SCHEDULE = {
    'fetch-push-logs-every-minute': {
        'task': 'fetch-push-logs',
        'schedule': timedelta(minutes=1),
        'relative': True,
        'options': {
            "queue": "pushlog"
        }
    },
    'fetch-buildapi-pending-every-minute': {
        'task': 'fetch-buildapi-pending',
        'schedule': timedelta(minutes=1),
        'relative': True,
        'options': {
            "queue": "buildapi_pending"
        }
    },
    'fetch-buildapi-running-every-minute': {
        'task': 'fetch-buildapi-running',
        'schedule': timedelta(minutes=1),
        'relative': True,
        'options': {
            "queue": "buildapi_running"
        }
    },
    'fetch-buildapi-build4h-every-3-minute': {
        'task': 'fetch-buildapi-build4h',
        'schedule': timedelta(minutes=3),
        'relative': True,
        'options': {
            "queue": "buildapi_4hr"
        }
    },
    'cycle-data-every-day': {
        'task': 'cycle-data',
        'schedule': timedelta(days=1),
        'relative': True,
        'options': {
            'queue': 'cycle_data'
        }
    },
    'calculate-eta-every-6-hours': {
        'task': 'calculate-eta',
        'schedule': timedelta(hours=6),
        'relative': True,
        'options': {
            'queue': 'calculate_eta'
        }
    },
    'fetch-bugs-every-hour': {
        'task': 'fetch-bugs',
        'schedule': timedelta(hours=1),
        'relative': True,
        'options': {
            'queue': 'fetch_bugs'
        }
    }
}

# rest-framework settings
REST_FRAMEWORK = {
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'EXCEPTION_HANDLER': 'treeherder.webapp.api.exceptions.exception_handler',
    'DEFAULT_THROTTLE_CLASSES': (
        'treeherder.webapp.api.throttling.OauthKeyThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'jobs': '220/minute',
        'resultset': '220/minute'
    },
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.AcceptHeaderVersioning',
    'DEFAULT_VERSION': '1.0',
    'ALLOWED_VERSIONS': ('1.0',),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'treeherder.webapp.api.auth.TwoLeggedOauthAuthentication',
    )
}

SITE_URL = os.environ.get("TREEHERDER_SITE_URL", "http://local.treeherder.mozilla.org")

BUILDAPI_PENDING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-pending.js"
BUILDAPI_RUNNING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-running.js"
BUILDAPI_BUILDS4H_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-4hr.js.gz"

# the max size of a posted request to treeherder client during Buildbot
# data job ingestion.
# If TreeherderCollections are larger, they will be chunked
# to this size.
BUILDAPI_PENDING_CHUNK_SIZE = 500
BUILDAPI_RUNNING_CHUNK_SIZE = 500
BUILDAPI_BUILDS4H_CHUNK_SIZE = 500

PARSER_MAX_STEP_ERROR_LINES = 100
PARSER_MAX_SUMMARY_LINES = 200
FAILURE_LINES_CUTOFF = 35

BZ_API_URL = "https://bugzilla.mozilla.org"

# this setting allows requests from any host
CORS_ORIGIN_ALLOW_ALL = True

# set ALLOWED_HOSTS to match your domain name.
# An asterisk means everything but it's not secure.
# IP addresses are also allowed. A dot is used to include all sub domains
if (os.environ.get('TREEHERDER_ALLOWED_HOSTS')):
    ALLOWED_HOSTS = [os.environ.get('TREEHERDER_ALLOWED_HOSTS')]
else:
    ALLOWED_HOSTS = [".mozilla.org", ".allizom.org"]

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Set this to True to submit bug associations to Bugzilla & Elasticsearch.
MIRROR_CLASSIFICATIONS = True
ES_HOST = "http://of-elasticsearch-zlb.webapp.scl3.mozilla.com:9200"

# TBPLBOT is the Bugzilla account used to make the bug comments on
# intermittent failure bugs when failures are classified.
TBPLBOT_EMAIL = os.environ.get("TBPLBOT_EMAIL", "")
TBPLBOT_PASSWORD = os.environ.get("TBPLBOT_PASSWORD", "")

# Bugzilla comments cannot be longer than 65535 characters, so we must ensure the
# comment length does not exceed this, or the comment will be rejected. We truncate
# to a length lower than the real limit, to reduce the amount of spam in bugs.
BZ_MAX_COMMENT_LENGTH = 40000

# timeout for requests to external sources
# like ftp.mozilla.org or hg.mozilla.org
TREEHERDER_REQUESTS_TIMEOUT = 30

# The pulse uri that is passed to kombu
PULSE_URI = os.environ.get("PULSE_URI", "amqps://guest:guest@pulse.mozilla.org/")

# Note we will never publish any pulse messages unless the exchange namespace is
# set this normally is your pulse username.
PULSE_EXCHANGE_NAMESPACE = None

# Note: All the configs below this import will take precedence over what is
# defined in local.py!
try:
    from .local import *
except ImportError:
    pass

INSTALLED_APPS += LOCAL_APPS

TEMPLATE_DEBUG = DEBUG

# The database config is defined using environment variables of form:
#   'mysql://username:password@host:optional_port/database_name'
DATABASES = {
    'default': dj_database_url.config(env='DATABASE_URL'),
    'read_only': dj_database_url.config(env='DATABASE_URL_RO')
}

# Setup ssl connection for aws rds.
# Once https://github.com/kennethreitz/dj-database-url/pull/52 is fixed,
# Heroku can have the option added to the DATABASE_URL query string,
# and this can be removed.
if 'IS_HEROKU' in os.environ:
    ca_path = '/app/deployment/aws/combined-ca-bundle.pem'
    for db_name in DATABASES:
        DATABASES[db_name]['OPTIONS'] = {
            'ssl': {
                'ca': ca_path
            }
        }

# TREEHERDER_MEMCACHED is a string of comma-separated address:port pairs
MEMCACHED_LOCATION = TREEHERDER_MEMCACHED.strip(',').split(',')

CACHES = {
    "default": {
        "BACKEND": "treeherder.cache.MemcachedCache",
        "LOCATION": MEMCACHED_LOCATION,
        "TIMEOUT": 0,
        # bumping this is effectively equivalent to restarting memcached
        "VERSION": 1,
    },
    "filesystem": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": path("webapp", "log_cache"),
        "TIMEOUT": 0,
        "VERSION": 1,
        'OPTIONS': {
            'MAX_ENTRIES': 1000
        }
    }
}

KEY_PREFIX = TREEHERDER_MEMCACHED_KEY_PREFIX

# celery broker setup
BROKER_URL = 'amqp://{0}:{1}@{2}:{3}/{4}'.format(
    RABBITMQ_USER,
    RABBITMQ_PASSWORD,
    RABBITMQ_HOST,
    RABBITMQ_PORT,
    RABBITMQ_VHOST
)

# This code handles the memcachier service on heroku.
if "IS_HEROKU" in os.environ:
    from memcacheify import memcacheify
    CACHES['default'].update(
        memcacheify().get('default')
    )

if "CLOUDAMQP_URL" in os.environ:
    BROKER_URL = os.environ["CLOUDAMQP_URL"]

CELERY_IGNORE_RESULT = True

API_HOSTNAME = SITE_URL

BROWSERID_AUDIENCES = [SITE_URL]

SWAGGER_SETTINGS = {"enabled_methods": ['get', ]}

REST_FRAMEWORK_EXTENSIONS = {
    'DEFAULT_CACHE_RESPONSE_TIMEOUT': 60 * 15
}
