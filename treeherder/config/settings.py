from __future__ import unicode_literals

import re
from datetime import timedelta

import environ
from kombu import (Exchange,
                   Queue)

from treeherder import path
from treeherder.config.utils import (connection_should_use_tls,
                                     get_tls_redis_url,
                                     hostname)

env = environ.Env()

DEBUG = env.bool("TREEHERDER_DEBUG", default=False)
ENABLE_DEBUG_TOOLBAR = env.bool("ENABLE_DEBUG_TOOLBAR", False)

GRAPHQL = env.bool("GRAPHQL", default=True)

# Default to retaining data for ~4 months.
DATA_CYCLE_DAYS = env.int("DATA_CYCLE_DAYS", default=120)
# Determines the number of jobs we try to delete per iteration when
# cycling data
DATA_CYCLE_CHUNK_SIZE = env.int("DATA_CYCLE_CHUNK_SIZE", default=100)
DATA_CYCLE_SLEEP_TIME = env.int("DATA_CYCLE_SLEEP_TIME", default=0)

# Make this unique, and don't share it with anybody.
SECRET_KEY = env("TREEHERDER_DJANGO_SECRET_KEY")

ROOT_URLCONF = "treeherder.config.urls"
WSGI_APPLICATION = 'treeherder.config.wsgi.application'

TIME_ZONE = "UTC"
USE_I18N = False
USE_L10N = True

# Files in this directory will be served by WhiteNoise at the site root.
WHITENOISE_ROOT = path("..", "dist")

STATIC_ROOT = path("static")
STATIC_URL = "/static/"

# Default minimum regression threshold for perfherder is 2% (otherwise
# e.g. the build size tests will alert on every commit)
PERFHERDER_REGRESSION_THRESHOLD = 2

# Various settings for treeherder's t-test "sliding window" alert algorithm
PERFHERDER_ALERTS_MIN_BACK_WINDOW = 12
PERFHERDER_ALERTS_MAX_BACK_WINDOW = 24
PERFHERDER_ALERTS_FORE_WINDOW = 12

# Only generate alerts for data newer than this time in seconds in perfherder
PERFHERDER_ALERTS_MAX_AGE = timedelta(weeks=2)

# Create hashed+gzipped versions of assets during collectstatic,
# which will then be served by WhiteNoise with a suitable max-age.
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'APP_DIRS': True,
    },
]

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
    'debug_toolbar.middleware.DebugToolbarMiddleware' if ENABLE_DEBUG_TOOLBAR else False,
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'treeherder.middleware.FixedHawkResponseMiddleware',
] if middleware]

if ENABLE_DEBUG_TOOLBAR:
    # django-debug-toolbar requires that not only DEBUG be set, but that the request IP
    # be in Django's INTERNAL_IPS setting. When using Vagrant, requests don't come from localhost:
    # http://blog.joshcrompton.com/2014/01/how-to-make-django-debug-toolbar-display-when-using-vagrant/
    # If the Vagrant IPs vary by platform or if there isn't a consistent IP when we switch to Docker,
    # we'll have to do: https://github.com/jazzband/django-debug-toolbar/pull/805#issuecomment-240976813
    INTERNAL_IPS = ['127.0.0.1', '10.0.2.2']

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

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    # Disable Django's own staticfiles handling in favour of WhiteNoise, for
    # greater consistency between gunicorn and `./manage.py runserver`.
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',
    # 3rd party apps
    'rest_framework',
    'hawkrest',
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
    'treeherder.credentials',
    'treeherder.seta',
]

if ENABLE_DEBUG_TOOLBAR:
    INSTALLED_APPS.append('debug_toolbar')

if DEBUG:
    INSTALLED_APPS.append('django_extensions')

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
            'level': 'WARNING',
        },
        'kombu': {
            'handlers': ['console'],
            'level': 'WARNING',
        }
    }
}

if DEBUG:
    # TODO: Fold this into the logging config above, as part of bug 1318021.
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': True,
        'formatters': {
            'standard': {
                'format': "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] %(message)s",
            },
        },
        'handlers': {
            'console': {
                'level': 'DEBUG',
                'class': 'logging.StreamHandler',
                'formatter': 'standard'
            },
        },
        'loggers': {
            'django': {
                'handlers': ['console'],
                'level': 'INFO',
                'propagate': True,
            },
            'hawkrest': {
                'handlers': ['console'],
                'level': 'WARNING',
            },
            'treeherder': {
                'handlers': ['console'],
                'level': 'DEBUG',
                'propagate': False,
            }
        }
    }

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
    # Queue for mirroring the failure classification activity to Elasticsearch.
    Queue('classification_mirroring', Exchange('default'), routing_key='classification_mirroring'),
    Queue('publish_to_pulse', Exchange('default'), routing_key='publish_to_pulse'),
    Queue('pushlog', Exchange('default'), routing_key='pushlog'),
    Queue('buildapi_pending', Exchange('default'), routing_key='buildapi_pending'),
    Queue('buildapi_running', Exchange('default'), routing_key='buildapi_running'),
    Queue('buildapi_4hr', Exchange('default'), routing_key='buildapi_4hr'),
    Queue('fetch_runnablejobs', Exchange('default'), routing_key='fetch_runnablejobs'),
    Queue('cycle_data', Exchange('default'), routing_key='cycle_data'),
    Queue('fetch_bugs', Exchange('default'), routing_key='fetch_bugs'),
    Queue('generate_perf_alerts', Exchange('default'), routing_key='generate_perf_alerts'),
    Queue('store_pulse_jobs', Exchange('default'), routing_key='store_pulse_jobs'),
    Queue('store_pulse_resultsets', Exchange('default'), routing_key='store_pulse_resultsets'),
    Queue('seta_analyze_failures', Exchange('default'), routing_key='seta_analyze_failures'),
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
BROKER_HEARTBEAT = None
BROKER_CONNECTION_TIMEOUT = 30
CELERY_RESULT_BACKEND = None
CELERY_SEND_EVENTS = False
CELERY_EVENT_QUEUE_EXPIRES = 60

CELERY_IGNORE_RESULT = True

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

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
    'fetch-runnablejobs-every-day': {
        'task': 'fetch-runnablejobs',
        'schedule': timedelta(hours=4),
        'relative': True,
        'options': {
            'queue': "fetch_runnablejobs"
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
    'fetch-bugs-every-hour': {
        'task': 'fetch-bugs',
        'schedule': timedelta(hours=1),
        'relative': True,
        'options': {
            'queue': 'fetch_bugs'
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

# rest-framework settings
REST_FRAMEWORK = {
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'rest_framework_filters.backends.DjangoFilterBackend',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'treeherder.webapp.api.throttling.HawkClientThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'jobs': '220/minute',
        'push': '400/minute'  # temporary increase: https://bugzilla.mozilla.org/show_bug.cgi?id=1232776
    },
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.AcceptHeaderVersioning',
    'DEFAULT_VERSION': '1.0',
    'ALLOWED_VERSIONS': ('1.0',),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'hawkrest.HawkAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}

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

SITE_URL = env("SITE_URL", default="http://localhost:8000/")
SITE_HOSTNAME = hostname(SITE_URL)
APPEND_SLASH = False

BUILDAPI_PENDING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-pending.js"
BUILDAPI_RUNNING_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-running.js"
BUILDAPI_BUILDS4H_URL = "https://secure.pub.build.mozilla.org/builddata/buildjson/builds-4hr.js.gz"
ALLTHETHINGS_URL = "https://secure.pub.build.mozilla.org/builddata/reports/allthethings.json"
TASKCLUSTER_INDEX_URL = 'https://index.taskcluster.net/v1/task/gecko.v2.%s.latest.firefox.decision'
TASKCLUSTER_RUNNABLE_JOBS_URL = 'https://public-artifacts.taskcluster.net/{task_id}/0/public/runnable-jobs.json.gz'

# the amount of time we cache bug suggestion lookups (to speed up loading the bug
# suggestions or autoclassify panels for recently finished jobs)
BUG_SUGGESTION_CACHE_TIMEOUT = 86400

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

# BZ_API_URL is used to fetch bug suggestions from bugzilla
# BUGFILER_API_URL is used when filing bugs
# these are no longer necessarily the same so stage treeherder can submit
# to stage bmo, while suggestions can still be fetched from prod bmo
BZ_API_URL = "https://bugzilla.mozilla.org"
BUGFILER_API_URL = env("BUGZILLA_API_URL", default=BZ_API_URL)
BUGFILER_API_KEY = env("BUGZILLA_API_KEY", default=None)

# Auth0 setup
AUTH0_DOMAIN = env('AUTH0_DOMAIN', default="auth.mozilla.auth0.com")
AUTH0_CLIENTID = env('AUTH0_CLIENTID', default="q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z")

ORANGEFACTOR_SUBMISSION_URL = "https://brasstacks.mozilla.com/orangefactor/api/saveclassification"
ORANGEFACTOR_HAWK_ID = "treeherder"
ORANGEFACTOR_HAWK_KEY = env("ORANGEFACTOR_HAWK_KEY", default=None)

# this setting allows requests from any host
CORS_ORIGIN_ALLOW_ALL = True

ALLOWED_HOSTS = [SITE_HOSTNAME]

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

# Set the `X-Content-Type-Options` header to `nosniff`.
SECURE_CONTENT_TYPE_NOSNIFF = True
# Set the `X-XSS-Protection` header.
SECURE_BROWSER_XSS_FILTER = True
# Set the `X-Frame-Options` header, which forbids embedding of site pages in frames other than origin.
# AUTH0 renewal opens the auth handler page in an invisible frame
# hence requiring the need to support frames with same origin
X_FRAME_OPTIONS = 'SAMEORIGIN'

SILENCED_SYSTEM_CHECKS = [
    # We can't set CSRF_COOKIE_HTTPONLY to True since the requests to the API
    # made using Angular's `httpProvider` require access to the cookie.
    'security.W017',
    # We can't set X_FRAME_OPTIONS to DENY since renewal of auth token requires
    # opening an invisible iframe with the same origin.
    'security.W019'
]

# Enable integration between autoclassifier and jobs
AUTOCLASSIFY_JOBS = env.bool("AUTOCLASSIFY_JOBS", default=True)
# Ordered list of matcher classes to use during autoclassification
AUTOCLASSIFY_MATCHERS = ["PreciseTestMatcher", "CrashSignatureMatcher",
                         "ElasticSearchTestMatcher"]

# timeout for requests to external sources
# like ftp.mozilla.org or hg.mozilla.org
REQUESTS_TIMEOUT = 30
TREEHERDER_USER_AGENT = 'treeherder/{}'.format(SITE_HOSTNAME)

# The pulse uri that is passed to kombu
PULSE_URI = env("PULSE_URI", default="amqps://guest:guest@pulse.mozilla.org/")

# Note we will never publish any pulse messages unless the exchange namespace is
# set this normally is your pulse username.
PULSE_EXCHANGE_NAMESPACE = env("PULSE_EXCHANGE_NAMESPACE", default=None)

# Specifies the Pulse exchanges Treeherder will ingest data from.  This list
# will be updated as new applications come online that Treeherder supports.
# Treeherder will subscribe with routing keys that are all combinations of
# ``project`` and ``destination`` in the form of:
#     <destination>.<project>
# Wildcards such as ``#`` and ``*`` are supported for either field.
PULSE_DATA_INGESTION_SOURCES = env.json(
    "PULSE_DATA_INGESTION_SOURCES",
    default=[
        {
            "exchange": "exchange/taskcluster-treeherder/v1/jobs",
            "projects": [
                '#'
                # some specific repos TC can ingest from
                # 'mozilla-central.#',
                # 'mozilla-inbound.#'
            ],
            "destinations": [
                '#'
                # 'production',
                # 'staging'
            ]
        }
        # ... other CI systems
    ])

PULSE_PUSH_SOURCES = env.json(
    "PULSE_PUSH_SOURCES",
    default=[
        {
            "exchange": "exchange/taskcluster-github/v1/push",
            "routing_keys": [
                '#'
            ],
        },
        {
            "exchange": "exchange/taskcluster-github/v1/pull-request",
            "routing_keys": [
                '#'
            ],
        },
        {
            "exchange": "exchange/hgpushes/v1",
            "routing_keys": [
                "#"
            ]
        }
        # ... other CI systems
    ])

# Used for making API calls to Pulse Guardian, such as detecting bindings on
# the current ingestion queue.
PULSE_GUARDIAN_URL = "https://pulseguardian.mozilla.org/"

# Used to specify the PulseGuardian account that will be used to create
# ingestion queues for the exchanges specified in ``PULSE_DATA_INGESTION_SOURCES``.
# See https://pulse.mozilla.org/whats_pulse for more info.
# Example: "amqp://myuserid:mypassword@pulse.mozilla.org:5672/?ssl=1"
PULSE_DATA_INGESTION_CONFIG = env.url("PULSE_DATA_INGESTION_CONFIG", default="")

# Whether the Queues created for pulse ingestion are durable or not.
# For local data ingestion, you probably should set this to False
PULSE_DATA_INGESTION_QUEUES_DURABLE = True

# Whether the Queues created for pulse ingestion auto-delete after connections
# are closed.
# For local data ingestion, you probably should set this to True
PULSE_DATA_INGESTION_QUEUES_AUTO_DELETE = False

GITHUB_CLIENT_ID = env("GITHUB_CLIENT_ID", default=None)
GITHUB_CLIENT_SECRET = env("GITHUB_CLIENT_SECRET", default=None)

# The database config is defined using environment variables of form:
#   'mysql://username:password@host:optional_port/database_name'
# ...which django-environ converts into the Django DB settings dict format.
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

HAWK_CREDENTIALS_LOOKUP = 'treeherder.webapp.api.auth.hawk_lookup'

# Configuration for elasticsearch backend
ELASTIC_SEARCH = {
    "url": env.str('ELASTICSEARCH_URL', default=""),
    "index_prefix": ""
}

TRUNK_REPO_NAMES = ['mozilla-central', 'mozilla-inbound', 'autoland', 'fx-team']
