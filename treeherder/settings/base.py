# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

# Django settings for webapp project.
import os
import sys
from datetime import timedelta
from treeherder import path

# Insure the vendor libraries are added to the python path
# in production
sys.path.append( path('..', 'vendor') )


# These settings can all be optionally set via env vars, or in local.py:

TREEHERDER_DATABASE_NAME = os.environ.get("TREEHERDER_DATABASE_NAME", "")
TREEHERDER_DATABASE_USER = os.environ.get("TREEHERDER_DATABASE_USER", "")
TREEHERDER_DATABASE_PASSWORD = os.environ.get("TREEHERDER_DATABASE_PASSWORD", "")
TREEHERDER_DATABASE_HOST = os.environ.get("TREEHERDER_DATABASE_HOST", "localhost")
TREEHERDER_DATABASE_PORT = os.environ.get("TREEHERDER_DATABASE_PORT", "")

TREEHERDER_RO_DATABASE_USER = os.environ.get("TREEHERDER_RO_DATABASE_USER", TREEHERDER_DATABASE_USER)
TREEHERDER_RO_DATABASE_PASSWORD = os.environ.get("TREEHERDER_RO_DATABASE_PASSWORD", TREEHERDER_DATABASE_PASSWORD)
TREEHERDER_RO_DATABASE_HOST = os.environ.get("TREEHERDER_RO_DATABASE_HOST", TREEHERDER_DATABASE_HOST)

TREEHERDER_MEMCACHED = os.environ.get("TREEHERDER_MEMCACHED", "")
TREEHERDER_MEMCACHED_KEY_PREFIX = os.environ.get("TREEHERDER_MEMCACHED_KEY_PREFIX", "treeherder")
DEBUG = os.environ.get("TREEHERDER_DEBUG", False)

TREEHERDER_REQUEST_PROTOCOL = os.environ.get("TREEHERDER_REQUEST_PROTOCOL", "http")
TREEHERDER_REQUEST_HOST = os.environ.get("TREEHERDER_REQUEST_HOST", "local.treeherder.mozilla.org")

TREEHERDER_PERF_SERIES_TIME_RANGES = [
    { "seconds":86400, "days":1 },
    { "seconds":604800, "days":7 },
    { "seconds":1209600, "days":14 },
    { "seconds":2592000, "days":30 },
    { "seconds":5184000, "days":60 },
    { "seconds":7776000, "days":90 },
]

DATA_CYCLE_INTERVAL = timedelta(days=30*4)

RABBITMQ_USER = os.environ.get("TREEHERDER_RABBITMQ_USER", "")
RABBITMQ_PASSWORD = os.environ.get("TREEHERDER_RABBITMQ_PASSWORD", "")
RABBITMQ_VHOST = os.environ.get("TREEHERDER_RABBITMQ_VHOST", "")
RABBITMQ_HOST = os.environ.get("TREEHERDER_RABBITMQ_HOST", "")
RABBITMQ_PORT = os.environ.get("TREEHERDER_RABBITMQ_PORT", "")

# Make this unique, and don't share it with anybody.
SECRET_KEY = os.environ.get("TREEHERDER_DJANGO_SECRET_KEY", "my-secret-key")

ADMINS = []  # TBD
MANAGERS = ADMINS

SITE_ID = 1
ROOT_URLCONF = "treeherder.webapp.urls"
WSGI_APPLICATION = 'treeherder.webapp.wsgi.application'

TIME_ZONE = "America/Los_Angeles"
LANGUAGE_CODE = "en-us"
USE_I18N = False
USE_L10N = True
USE_TZ = False


STATIC_ROOT = path("webapp", "static")
STATIC_URL = "/static/"

MEDIA_ROOT = path("webapp", "media")
MEDIA_URL = "/media/"

# Additional locations of static files
STATICFILES_DIRS = []
STATICFILES_FINDERS = [
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
    #"django.contrib.staticfiles.finders.DefaultStorageFinder",
]

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
   'django_browserid.context_processors.browserid',
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
    'south',
    'rest_framework',
    'rest_framework_extensions',
    'corsheaders',
    'django_browserid',
    # treeherder apps
    'treeherder.model',
    'treeherder.webapp',
    'treeherder.log_parser',
    'treeherder.etl',
    'treeherder.workers',
    'treeherder.embed',

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

from kombu import Exchange, Queue

CELERY_QUEUES = (
    Queue('default', Exchange('default'), routing_key='default'),
    # queue for failed jobs/logs
    Queue('log_parser_fail', Exchange('default'), routing_key='parse_log.failures'),
    # queue for successful jobs/logs
    Queue('log_parser', Exchange('default'), routing_key='parse_log.success'),
    # this is used to give priority to some logs, for example when we need to
    # parse a log on demand
    Queue('log_parser_hp', Exchange('default'), routing_key='parse_log.high_priority'),
    # queue for mirroring the sheriffing activity to tbpl
    Queue('high_priority', Exchange('default'), routing_key='high_priority'),
    Queue('pushlog', Exchange('default'), routing_key='pushlog'),
    Queue('buildapi', Exchange('default'), routing_key='buildapi')
)

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'


# default value when no task routing info is specified
CELERY_DEFAULT_QUEUE = 'default'
CELERY_DEFAULT_EXCHANGE_TYPE = 'direct'
CELERY_DEFAULT_ROUTING_KEY = 'default'

from datetime import timedelta

CELERYBEAT_SCHEDULE = {
    'fetch-push-logs-every-minute': {
        'task': 'fetch-push-logs',
        'schedule': timedelta(minutes=1),
        'options': {
            "queue": "pushlog"
        },
        'relative': True
    },
    'fetch-buildapi-pending-every-minute': {
        'task': 'fetch-buildapi-pending',
        'schedule': timedelta(minutes=1),
        'options': {
            "queue": "buildapi"
        },
        'relative': True
    },
    'fetch-buildapi-running-every-minute': {
        'task': 'fetch-buildapi-running',
        'schedule': timedelta(minutes=1),
        'options': {
            "queue": "buildapi"
        },
        'relative': True
    },
    'fetch-buildapi-build4h-every-3-minute': {
        'task': 'fetch-buildapi-build4h',
        'schedule': timedelta(minutes=3),
        'options': {
            "queue": "buildapi"
        },
        'relative': True
    },
    'fetch-process-objects-every-minute': {
        'task': 'process-objects',
        'schedule': timedelta(minutes=1),
        'relative': True
    },
    'cycle-data-every-day': {
        'task': 'cycle-data',
        'schedule': timedelta(days=1),
        'relative': True
    },
    'calculate-eta-every-6-hours': {
        'task': 'calculate-eta',
        'schedule': timedelta(hours=6),
        'relative': True
    },
    'fetch-bugs-every-hour': {
        'task': 'fetch-bugs',
        'schedule': timedelta(hours=1),
        'relative': True
    }
}

# rest-framework settings
REST_FRAMEWORK = {
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'EXCEPTION_HANDLER': 'treeherder.webapp.api.exceptions.exception_handler',
    'DEFAULT_THROTTLE_CLASSES': (
        'treeherder.webapp.api.throttling.OauthKeyThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'jobs': '220/minute',
        'objectstore': '220/minute',
        'resultset': '220/minute'
    }
}

SITE_URL = "http://local.treeherder.mozilla.org"

BUILDAPI_PENDING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-pending.js"
BUILDAPI_RUNNING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-running.js"
BUILDAPI_BUILDS4H_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-4hr.js.gz"

BZ_API_URL = "https://bugzilla.mozilla.org"

# this setting allows requests from any host
CORS_ORIGIN_ALLOW_ALL = True

# set ALLOWED_HOSTS to match your domain name.
# An asterisk means everything but it's not secure.
# IP addresses are also allowed. A dot is used to include all sub domains
ALLOWED_HOSTS = [".mozilla.org", ".allizom.org"]
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Set this to True to submit bug associations to Bugzilla & OrangeFactor.
TBPL_BUGS_TRANSFER_ENABLED = True
ES_HOST = "http://elasticsearch-zlb.webapp.scl3.mozilla.com:9200"

# TBPLBOT is the Bugzilla account used to make the bug comments on
# intermittent failure bugs when failures are classified.
TBPLBOT_EMAIL = os.environ.get("TBPLBOT_EMAIL", "")
TBPLBOT_PASSWORD = os.environ.get("TBPLBOT_PASSWORD", "")

# timeout for requests to external sources
# like ftp.mozilla.org or hg.mozilla.org
TREEHERDER_REQUESTS_TIMEOUT = 30

try:
    from .local import *
except ImportError:
    pass

INSTALLED_APPS += LOCAL_APPS

TEMPLATE_DEBUG = DEBUG

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": TREEHERDER_DATABASE_NAME,
        "USER": TREEHERDER_DATABASE_USER,
        "PASSWORD": TREEHERDER_DATABASE_PASSWORD,
        "HOST": TREEHERDER_DATABASE_HOST,
        "PORT": TREEHERDER_DATABASE_PORT,
    },
    "read_only": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": TREEHERDER_DATABASE_NAME,
        "USER": TREEHERDER_RO_DATABASE_USER,
        "PASSWORD": TREEHERDER_RO_DATABASE_PASSWORD,
        "HOST": TREEHERDER_RO_DATABASE_HOST,
        "PORT": TREEHERDER_DATABASE_PORT,
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

CELERY_IGNORE_RESULT = True

API_HOSTNAME = SITE_URL

BROWSERID_AUDIENCES = [SITE_URL]

SWAGGER_SETTINGS = {"enabled_methods": ['get',]}

REST_FRAMEWORK_EXTENSIONS = {
    'DEFAULT_CACHE_RESPONSE_TIMEOUT': 60 * 15
}

# Username and password for pulse
PULSE_USERNAME = os.environ.get("PULSE_USERNAME", "")
PULSE_PASSWORD = os.environ.get("PULSE_PASSWORD", "")
