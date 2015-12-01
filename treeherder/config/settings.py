from datetime import timedelta

import environ
from kombu import (Exchange,
                   Queue)

from treeherder import path

env = environ.Env()

TREEHERDER_MEMCACHED = env("TREEHERDER_MEMCACHED", default="127.0.0.1:11211")
TREEHERDER_MEMCACHED_KEY_PREFIX = env("TREEHERDER_MEMCACHED_KEY_PREFIX", default="treeherder")

DEBUG = env.bool("TREEHERDER_DEBUG", default=False)

TREEHERDER_REQUEST_PROTOCOL = env("TREEHERDER_REQUEST_PROTOCOL", default="http")
TREEHERDER_REQUEST_HOST = env("TREEHERDER_REQUEST_HOST", default="local.treeherder.mozilla.org")

# Default to retaining data for ~4 months.
DATA_CYCLE_DAYS = env.int("DATA_CYCLE_DAYS", default=120)

# Make this unique, and don't share it with anybody.
SECRET_KEY = env("TREEHERDER_DJANGO_SECRET_KEY")

SITE_ID = 1
ROOT_URLCONF = "treeherder.config.urls"
WSGI_APPLICATION = 'treeherder.config.wsgi.application'

TIME_ZONE = "America/Los_Angeles"
USE_I18N = False
USE_L10N = True

SERVE_MINIFIED_UI = env.bool("SERVE_MINIFIED_UI", default=False)
WHITENOISE_ROOT = path("..", "dist" if SERVE_MINIFIED_UI else "ui")

STATIC_ROOT = path("static")
STATIC_URL = "/static/"

MEDIA_ROOT = path("media")
MEDIA_URL = "/media/"

# Default minimum regression threshold for perfherder is 1% (otherwise
# e.g. the build size tests will alert on every commit)
PERFHERDER_REGRESSION_THRESHOLD = 2

# Only generate alerts for data newer than this time in seconds in perfherder
PERFHERDER_ALERTS_MAX_AGE = timedelta(weeks=2)

# Create hashed+gzipped versions of assets during collectstatic,
# which will then be served by WhiteNoise with a suitable max-age.
STATICFILES_STORAGE = 'whitenoise.django.GzipManifestStaticFilesStorage'

TEMPLATE_LOADERS = [
    "django.template.loaders.filesystem.Loader",
    "django.template.loaders.app_directories.Loader",
    "django.template.loaders.eggs.Loader",
]
TEMPLATE_DIRS = [
    path("templates")
]

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.contrib.auth.context_processors.auth',
    'django.contrib.messages.context_processors.messages'
)

MIDDLEWARE_CLASSES = [
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'hawkrest.middleware.HawkResponseMiddleware',
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
    'hawkrest',
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
    'treeherder.autoclassify',
    'treeherder.credentials',
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
            'class': 'logging.StreamHandler',
            'formatter': 'standard'
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': True,
        },
        'hawkrest': {
            'handlers': ['console'],
            'level': 'WARNING',
        },
        'treeherder': {
            'handlers': ['console'],
            'level': 'ERROR',
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
    Queue('autoclassify', Exchange('default'), routing_key='autoclassify'),
    Queue('detect_intermittents', Exchange('default'), routing_key='detect_intermittents'),
    # Queue for mirroring the failure classification activity to Elasticsearch.
    Queue('classification_mirroring', Exchange('default'), routing_key='classification_mirroring'),
    Queue('error_summary', Exchange('default'), routing_key='error_summary'),
    Queue('publish_to_pulse', Exchange('default'), routing_key='publish_to_pulse'),
    Queue('pushlog', Exchange('default'), routing_key='pushlog'),
    Queue('fetch_missing_push_logs', Exchange('default'), routing_key='fetch_missing_push_logs'),
    Queue('buildapi_pending', Exchange('default'), routing_key='buildapi_pending'),
    Queue('buildapi_running', Exchange('default'), routing_key='buildapi_running'),
    Queue('buildapi_4hr', Exchange('default'), routing_key='buildapi_4hr'),
    Queue('fetch_allthethings', Exchange('default'), routing_key='fetch_allthethings'),
    Queue('cycle_data', Exchange('default'), routing_key='cycle_data'),
    Queue('calculate_durations', Exchange('default'), routing_key='calculate_durations'),
    Queue('fetch_bugs', Exchange('default'), routing_key='fetch_bugs'),
    Queue('store_pulse_jobs', Exchange('default'), routing_key='store_pulse_jobs'),
    Queue('generate_perf_alerts', Exchange('default'), routing_key='generate_perf_alerts'),
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
    'fetch-allthethings-every-day': {
        'task': 'fetch-allthethings',
        'schedule': timedelta(days=1),
        'relative': True,
        'options': {
            'queue': "fetch_allthethings"
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
    'calculate-durations-every-6-hours': {
        'task': 'calculate-durations',
        'schedule': timedelta(hours=6),
        'relative': True,
        'options': {
            'queue': 'calculate_durations'
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
        'treeherder.webapp.api.throttling.HawkClientThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'jobs': '220/minute',
        'resultset': '400/minute'  # temporary increase: https://bugzilla.mozilla.org/show_bug.cgi?id=1232776
    },
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.AcceptHeaderVersioning',
    'DEFAULT_VERSION': '1.0',
    'ALLOWED_VERSIONS': ('1.0',),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'hawkrest.HawkAuthentication',
    ),
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}

SITE_URL = env("SITE_URL", default="http://local.treeherder.mozilla.org")
APPEND_SLASH = False

BUILDAPI_PENDING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-pending.js"
BUILDAPI_RUNNING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-running.js"
BUILDAPI_BUILDS4H_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-4hr.js.gz"
ALLTHETHINGS_URL = "https://secure.pub.build.mozilla.org/builddata/reports/allthethings.json"

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
ALLOWED_HOSTS = env.list("TREEHERDER_ALLOWED_HOSTS", default=[".mozilla.org", ".allizom.org"])

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Set this to True to submit bug associations to Elasticsearch.
MIRROR_CLASSIFICATIONS = True
ES_HOST = "http://of-elasticsearch-zlb.webapp.scl3.mozilla.com:9200"

# timeout for requests to external sources
# like ftp.mozilla.org or hg.mozilla.org
REQUESTS_TIMEOUT = 30
TREEHERDER_USER_AGENT = 'treeherder/{}'.format(TREEHERDER_REQUEST_HOST)

# The pulse uri that is passed to kombu
PULSE_URI = env("PULSE_URI", default="amqps://guest:guest@pulse.mozilla.org/")

# Note we will never publish any pulse messages unless the exchange namespace is
# set this normally is your pulse username.
PULSE_EXCHANGE_NAMESPACE = env("PULSE_EXCHANGE_NAMESPACE", default=None)

# Specifies the Pulse exchanges Treeherder will ingest data from.  This list
# will be updated as new applications come online that Treeherder supports.
# Can be overridden in settings_local.py to specify fewer or completely different
# exchanges for testing purposes on local machines.
# Treeherder will subscribe with routing keys that are all combinations of
# ``project`` and ``destination`` in the form of:
#     <project>.<destination>
# Wildcards such as ``#`` and ``*`` are supported for either field.
PULSE_DATA_INGESTION_EXCHANGES = env.json(
    "PULSE_DATA_INGESTION_EXCHANGES",
    default=[
        # {
        #     "name": "exchange/taskcluster-treeherder/jobs",
        #     "projects": [
        #         'mozilla-central',
        #         'mozilla-inbound'
        #         # other repos TC can submit to
        #     ],
        #     "destinations": [
        #         'production'
        #         'staging'
        #     ]
        # },
        # {
        #     "name": "exchange/treeherder-test/jobs",
        #     "projects": [
        #         'mozilla-inbound'
        #     ],
        #     "destinations": [
        #         'production'
        #         'staging'
        #     ]
        #
        # }
        # ... other CI systems
    ])

# Used to specify the PulseGuardian account that will be used to create
# ingestion queues for the exchanges specified in ``PULSE_DATA_INGESTION_EXCHANGES``.
# See https://pulse.mozilla.org/whats_pulse for more info.
# Example: "amqp://myuserid:mypassword@pulse.mozilla.org:5672/"
PULSE_DATA_INGESTION_CONFIG = env.url("PULSE_DATA_INGESTION_CONFIG", default="")

# Whether the Queues created for pulse ingestion are durable or not.
# For local data ingestion, you probably should set this to False
PULSE_DATA_INGESTION_QUEUES_DURABLE = env.bool("PULSE_DATA_INGESTION_QUEUES_DURABLE",
                                               default=True)

# Whether the Queues created for pulse ingestion auto-delete after connections
# are closed.
# For local data ingestion, you probably should set this to True
PULSE_DATA_INGESTION_QUEUES_AUTO_DELETE = env.bool("PULSE_DATA_INGESTION_QUEUES_AUTO_DELETE",
                                                   default=False)

# The git-ignored settings_local.py file should only be used for local development.
if env.bool("ENABLE_LOCAL_SETTINGS_FILE", default=False):
    # Note: All the configs below this import will take precedence over what is
    # defined in settings_local.py!
    try:
        from .settings_local import *
    except ImportError:
        pass

INSTALLED_APPS += LOCAL_APPS

TEMPLATE_DEBUG = DEBUG

# The database config is defined using environment variables of form:
#   'mysql://username:password@host:optional_port/database_name'
DATABASES = {
    'default': env.db_url('DATABASE_URL'),
    'read_only': env.db_url('DATABASE_URL_RO')
}

# Setup ssl connection for aws rds.
# Can be removed when django-environ supports setting this:
# https://github.com/joke2k/django-environ/issues/72
if env.bool('IS_HEROKU', default=False):
    for db_name in DATABASES:
        DATABASES[db_name]['OPTIONS'] = {
            'ssl': {
                'ca': '/app/deployment/aws/combined-ca-bundle.pem'
            }
        }

# TREEHERDER_MEMCACHED is a string of comma-separated address:port pairs
MEMCACHED_LOCATION = TREEHERDER_MEMCACHED.strip(',').split(',')

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.memcached.MemcachedCache",
        "LOCATION": MEMCACHED_LOCATION,
        # Cache forever
        "TIMEOUT": None,
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

# Celery broker setup
BROKER_URL = env('BROKER_URL')

# This code handles the memcachier service on heroku.
if env.bool('IS_HEROKU', default=False):
    from memcacheify import memcacheify
    CACHES['default'].update(
        memcacheify().get('default')
    )

if env('CLOUDAMQP_URL', default=None):
    BROKER_URL = env('CLOUDAMQP_URL')

CELERY_IGNORE_RESULT = True

API_HOSTNAME = SITE_URL

BROWSERID_AUDIENCES = [SITE_URL]

SWAGGER_SETTINGS = {"enabled_methods": ['get', ]}

REST_FRAMEWORK_EXTENSIONS = {
    'DEFAULT_CACHE_RESPONSE_TIMEOUT': 60 * 15
}

HAWK_CREDENTIALS_LOOKUP = 'treeherder.webapp.api.auth.hawk_lookup'

# This is the client ID used by the internal data ingestion service.
ETL_CLIENT_ID = 'treeherder-etl'
