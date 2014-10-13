Troubleshooting
===============

CSP WARN: Directive "..." violated by https://browserid.org/include.js
----------------------------------------------------------------------

This warning appears in the Error Console when your site uses
`Content Security Policy`_ without making an exception for the persona.org
external JavaScript include.

To fix this, include https://persona.org in your script-src and frame-src
directive. If you're using the `django-csp`_ library, the following settings
will work::

    CSP_SCRIPT_SRC = ("'self'", 'https://login.persona.org')
    CSP_FRAME_SRC = ("'self'", 'https://login.persona.org')

.. _Content Security Policy: https://developer.mozilla.org/en/Security/CSP
.. _django-csp: https://github.com/mozilla/django-csp


Login fails silently due to SESSION_COOKIE_SECURE
-------------------------------------------------

If you try to login on a local instance of a site and login fails without any
error (typically redirecting you back to the login page), check to see if you've
set `SESSION_COOKIE_SECURE` to True in your settings.

`SESSION_COOKIE_SECURE` controls if the `secure` flag is set on the session
cookie. If set to True on a local instance of a site that does not use HTTPS,
the session cookie won't be sent by your browser because you're using an HTTP
connection.

The solution is to set `SESSION_COOKIE_SECURE` to False on your local instance,
typically by adding it to `settings/local.py`::

    SESSION_COOKIE_SECURE = False


Login fails silently due to cache issues
----------------------------------------

Another possible cause of silently failing logins is an issue with having no
cache configured locally. Several projects (especially projects based on
playdoh_, which uses `django-session-csrf`_) store session info in the cache
rather than the database, and if your local instance has no cache configured,
the session information will not be stored and login will fail silently.

To solve this issue, you should configure your local instance to use an
in-memory cache with the following in your local settings file::

    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake'
        }
    }

.. _playdoh: https://github.com/mozilla/playdoh
.. _django-session-csrf: https://github.com/mozilla/django-session-csrf

Your website uses HTTPS but django-browserid thinks it's http
-------------------------------------------------------------

This will happen if you are using django-browserid behind a load balancer 
that is terminating your SSL connections, like nginx.
The ``request.is_secure()`` method will return false,
unless you tell Django that it is being served over https.
You will need to configure Django's `SECURE_PROXY_SSL_HEADER`_ 
with a value provided by your load balancer.
An example configuration might look like this::

    # settings.py
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTOCOL', 'https')
    
    # nginx
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	    proxy_set_header X-Forwarded-Protocol https; # Tell django we're using https
    }
    
.. _SECURE_PROXY_SSL_HEADER: https://docs.djangoproject.com/en/dev/ref/settings/#secure-proxy-ssl-header
