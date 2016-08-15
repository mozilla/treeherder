# Switch to using a different bugzilla instance
BZ_API_URL = "https://bugzilla-dev.allizom.org"

# Applications useful for development, e.g. debug_toolbar, django_extensions.
LOCAL_APPS = ['debug_toolbar']

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
        'logfile': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/treeherder/treeherder.log',
            'maxBytes': 5 * 1024 * 1024,
            'backupCount': 2,
            'formatter': 'standard',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'logfile'],
            'level': 'INFO',
            'propagate': True,
        },
        'hawkrest': {
            'handlers': ['console'],
            'level': 'WARNING',
        },
        'treeherder': {
            'handlers': ['console', 'logfile'],
            'level': 'DEBUG',
            'propagate': False,
        }
    }
}
