"""
WSGI config for webapp project.

This module contains the WSGI application used by Django's development server
and any production WSGI deployments. It should expose a module-level variable
named ``application``. Django's ``runserver`` and ``runfcgi`` commands discover
this application via the ``WSGI_APPLICATION`` setting.
"""
import os

# We defer to a DJANGO_SETTINGS_MODULE already in the environment. This breaks
# if running multiple sites in the same mod_wsgi process. To fix this, use
# mod_wsgi daemon mode with each site in its own daemon process, or use
# os.environ["DJANGO_SETTINGS_MODULE"] = "treeherder.config.settings"
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "treeherder.config.settings")

import environ
from django.core.cache.backends.memcached import BaseMemcachedCache
from django.core.wsgi import get_wsgi_application as django_app
from wsgi_sslify import sslify

from treeherder.config.whitenoise_custom import CustomWhiteNoise

env = environ.Env()

# Wrap the Django WSGI app with WhiteNoise so the UI can be served by gunicorn
# in production, avoiding the need for Apache/nginx on Heroku. WhiteNoise will
# serve the Django static files at /static/ and also those in the directory
# referenced by WHITENOISE_ROOT at the site root.
application = CustomWhiteNoise(django_app())

if env.bool('IS_HEROKU', default=False):
    # Redirect HTTP requests to HTTPS and set an HSTS header.
    # Required since the equivalent Django features will not be
    # able to alter requests that were served by WhiteNoise.
    application = sslify(application)

# Fix django closing connection to MemCachier after every request:
# https://code.djangoproject.com/ticket/11331
# Remove when https://github.com/django/django/pull/4866 fixed.
BaseMemcachedCache.close = lambda self, **kwargs: None
