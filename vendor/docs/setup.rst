Setup
=====

Installation
------------
You can use pip to install django-browserid and requirements::

    pip install django-browserid


Configuration
-------------
To use ``django-browserid``, you'll need to make a few changes to your
``settings.py`` file::

    # Add 'django_browserid' to INSTALLED_APPS.
    INSTALLED_APPS = (
        # ...
        'django.contrib.auth',
        'django_browserid',  # Load after auth
        # ...
    )

    # Add the django_browserid authentication backend.
    AUTHENTICATION_BACKENDS = (
       # ...
       'django.contrib.auth.backends.ModelBackend', # required for admin
       'django_browserid.auth.BrowserIDBackend',
       # ...
    )

    # Specify audiences (protocol, domain, port) that your site will handle.
    # Note! This is only needed if DEBUG = False
    BROWSERID_AUDIENCES = ['http://example.com:8000', 'https://my.example.com']

.. note:: For security reasons, it is *very important* that you set
   ``BROWSERID_AUDIENCES`` correctly. If it is incorrect, other sites could use
   assertions to impersonate users on your own site.

Next, edit your ``urls.py`` file and add the following::

    urlpatterns = patterns('',
        # ...
        (r'', include('django_browserid.urls')),
        # ...
    )

.. note:: The django-browserid urlconf *must not* have a regex with the
   include. Use a blank string, as shown above.

You can also set the following optional settings in ``settings.py``::

    # Path to redirect to on successful login.
    LOGIN_REDIRECT_URL = '/'

    # Path to redirect to on unsuccessful login attempt.
    LOGIN_REDIRECT_URL_FAILURE = '/'

    # Path to redirect to on logout.
    LOGOUT_REDIRECT_URL = '/'

Finally, you'll need to add the login button to your templates. There are three
things you will need to add to your templates:

1.  ``{% browserid_js %}``: Outputs the ``<script>`` tags for the button
    JavaScript. Must be somewhere on the page, typically at the bottom right
    before the ``</body>`` tag to allow the page to visibly load before
    executing.

2.  ``{% browserid_css %}``: Outputs ``<link>`` tags for optional CSS that
    styles login buttons to match Persona.

3.  ``{% browserid_login %}`` and ``{% browserid_logout %}``: Outputs the HTML
    for the login and logout buttons.

A complete example:

.. code-block:: html+django

    {% load browserid %}
    <html>
      <head>
        {% browserid_css %}
      </head>
      <body>
        <header>
          <h1>My Site</h1>
          <div class="authentication">
            {% if user.is_authenticated %}
              {% browserid_logout text='Logout' %}
            {% else %}
              {% browserid_login text='Login' color='dark' %}
            {% endif %}
          </div>
        </header>
        <article>
          <p>Welcome to my site!</p>
        </article>
        <script src="http://code.jquery.com/jquery-1.9.1.min.js"></script>
        {% browserid_js %}
      </body>
    </html>

If you're using `Jinja2`_ as your templating system, you can use the functions
passed to your template by the context processor:

.. code-block:: html+jinja

    <html>
      <head>
        {{ browserid_css() }}
      </head>
      <body>
        <header>
          <h1>My Site</h1>
          <div class="authentication">
            {% if user.is_authenticated() %}
              {{ browserid_logout(text='Logout') }}
            {% else %}
              {{ browserid_login(text='Login', color='dark') }}
            {% endif %}
          </div>
        </header>
        <article>
          <p>Welcome to my site!</p>
        </article>
        <script src="http://code.jquery.com/jquery-1.9.1.min.js"></script>
        {{ browserid_js() }}
      </body>
    </html>

.. note:: The JavaScript assumes you have `jQuery`_ 1.7 or higher on your site.

.. note:: For more information about the template helper functions, check out
   the :doc:`details/api` document.

.. _jQuery: http://jquery.com/
.. _Jinja2: http://jinja.pocoo.org/
.. _`Context Processor documentation`: https://docs.djangoproject.com/en/dev/ref/settings/#template-context-processors


BrowserID in the Django Admin
-----------------------------
You can add support for logging in to the Django admin interface with BrowserID
by using :data:`django_browserid.admin.site` instead of
:data:`django.contrib.admin.site`. In your ``admin.py`` files, register
ModelAdmin classes with the django-browserid site:

.. code-block:: python

    from django.contrib import admin

    from django_browserid.admin import site as browserid_admin

    from myapp.foo.models import Bar


    class BarAdmin(admin.ModelAdmin):
        pass
    browserid_admin.register(Bar, BarAdmin)

Then, use the django-browserid admin site in your ``urls.py`` as well:

.. code-block:: python

    from django.conf.urls import patterns, include, url

    # Autodiscover admin.py files in your project.
    from django.contrib import admin
    admin.autodiscover()

    # copy_registry copies ModelAdmins registered with the default site, like
    # the built-in Django User model.
    from django_browserid.admin import site as browserid_admin
    browserid_admin.copy_registry(admin.site)

    urlpatterns = patterns('',
        # ...
        url(r'^admin/', include(browserid_admin.urls)),
    )

See :class:`django_browserid.admin.BrowserIDAdminSite` for details on how to
customize the login page, such as including a normal login form.


Deploying to Production
-----------------------
There are a few changes you need to make when deploying your app to production:

- BrowserID uses an assertion and an audience to verify the user. The
  ``BROWSERID_AUDIENCES`` setting is used to determine the audience. For
  security reasons, it is *very important* that you set ``BROWSERID_AUDIENCES``
  correctly.

  ``BROWSERID_AUDIENCES`` should be set to the domains and protocols
  users will use to access your site, such as``https://affiliates.mozilla.org``.
  This URL does not have to be publicly available, however, so sites limited to
  a certain network can still use django-browserid.


Static Files
------------
``browserid_js`` and ``browserid_css`` the Django `staticfiles`_ app to serve
the static files for the buttons. If you don't want to use the static files
framework, you'll need to include the JavaScript and CSS manually on any page
you use the ``browserid_button`` function.

For ``browserid_js`` the files needed are the Persona JavaScript shim, which
should be loaded from
``https://login.persona.org/include.js`` in a script tag, and
``django_browserid/static/browserid/browserid.js``, which is part of the
django-browserid library.

For ``browserid_css`` the file needed is
``django_browserid/static/browserid/persona-buttons.css``, which is also part of
the django-browserid library.

.. _staticfiles: https://docs.djangoproject.com/en/dev/howto/static-files/


Content Security Policy
-----------------------
If your site uses `Content Security Policy`_, you will have to add directives
to allow the external persona.org JavaScript, as well as an iframe used as part
of the login process.

If you're using `django-csp`_, the following settings will work::

    CSP_SCRIPT_SRC = ("'self'", 'https://login.persona.org')
    CSP_FRAME_SRC = ("'self'", 'https://login.persona.org')

.. _Content Security Policy: https://developer.mozilla.org/en/Security/CSP
.. _django-csp: https://github.com/mozilla/django-csp


Alternate Template Languages (Jingo/Jinja)
------------------------------------------
If you are using a library like `Jingo`_ in order to use a template language
besides the Django template language, you may need to configure the library to
use the Django template language for django-browserid templates. With Jingo,
you can do this using the ``JINGO_EXCLUDE_APPS`` setting::

    JINGO_EXCLUDE_APPS = ('browserid',)

.. _Jingo: https://github.com/jbalogh/jingo


Troubleshooting Issues
----------------------
If you run into any issues while setting up django-browserid, try the following
steps:

1. Check for any warnings in the server log. You may have to edit your
   development server's logging settings to output ``django_browserid`` log
   entries. Here's an example ``LOGGING`` setup to start with::

       LOGGING = {
           'version': 1,
           'handlers': {
               'console':{
                   'level': 'DEBUG',
                   'class': 'logging.StreamHandler'
               },
           },
           'loggers': {
               'django_browserid': {
                   'handlers': ['console'],
                   'level': 'DEBUG',
               }
           },
        }

2. Check the :doc:`details/troubleshooting` document for commonly-reported
   issues.

3. Ask for help in the `#webdev`_ channel on irc.mozilla.org.

4. Post an issue on the `django-browserid Issue Tracker`_.

.. _#webdev: http://chat.mibbit.com/?channel=%23chat&server=irc.mozilla.org
.. _django-browserid Issue Tracker: https://github.com/mozilla/django-browserid/issues
