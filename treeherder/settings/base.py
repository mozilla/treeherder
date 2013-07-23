# Django settings for webapp project.
import os
from treeherder import path

# needed to setup celery
import djcelery
djcelery.setup_loader()

# These settings can all be optionally set via env vars, or in local.py:

TREEHERDER_DATABASE_NAME = os.environ.get("TREEHERDER_DATABASE_NAME", "")
TREEHERDER_DATABASE_USER = os.environ.get("TREEHERDER_DATABASE_USER", "")
TREEHERDER_DATABASE_PASSWORD = os.environ.get("TREEHERDER_DATABASE_PASSWORD", "")
TREEHERDER_DATABASE_HOST = os.environ.get("TREEHERDER_DATABASE_HOST", "localhost")
TREEHERDER_DATABASE_PORT = os.environ.get("TREEHERDER_DATABASE_PORT", "")

TREEHERDER_MEMCACHED = os.environ.get("TREEHERDER_MEMCACHED", "")
TREEHERDER_MEMCACHED_KEY_PREFIX = os.environ.get("TREEHERDER_MEMCACHED_KEY_PREFIX", "treeherder")
DEBUG = os.environ.get("TREEHERDER_DEBUG", False)

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

MIDDLEWARE_CLASSES = [
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    # Uncomment the next line for simple clickjacking protection:
    # 'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

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
    'djcelery',
    'south',
    'rest_framework',
    # treeherder apps
    'treeherder.model',
    'treeherder.webapp',
    'treeherder.log_parser',
    'treeherder.etl',

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
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse'
        }
    },
    'handlers': {
        'mail_admins': {
            'level': 'ERROR',
            'filters': ['require_debug_false'],
            'class': 'django.utils.log.AdminEmailHandler'
        }
    },
    'loggers': {
        'django.request': {
            'handlers': ['mail_admins'],
            'level': 'ERROR',
            'propagate': True,
        },
    }
}

from kombu import Exchange, Queue

CELERY_QUEUES = (
    Queue('default', Exchange('default'), routing_key='default'),
    # queue for failed jobs/logs
    Queue('fail', Exchange('fail'), routing_key='*.fail'),
    # queue for successful jobs/logs
    Queue('success', Exchange('success'), routing_key='*.success'),
)

# default value when no task routing info is specified
CELERY_DEFAULT_QUEUE = 'default'
CELERY_DEFAULT_EXCHANGE_TYPE = 'direct'
CELERY_DEFAULT_ROUTING_KEY = 'default'

CELERYBEAT_SCHEDULER = "djcelery.schedulers.DatabaseScheduler"

# rest-framework settings
REST_FRAMEWORK = {
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
    )
}

API_HOSTNAME = "http://localhost"

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
    }
}

CACHES = {
    "default": {
        "BACKEND": "treeherder.cache.MemcachedCache",
        "LOCATION": TREEHERDER_MEMCACHED,
        "TIMEOUT": 0,
        # bumping this is effectively equivalent to restarting memcached
        "VERSION": 1,
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
