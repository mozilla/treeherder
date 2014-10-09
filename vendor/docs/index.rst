django-browserid
================

django-browserid is a library that integrates BrowserID_ authentication into
Django_. By default it relies on the Persona_ Identity Provider.

django-browserid provides an authentication backend, ``BrowserIDBackend``, that
verifies BrowserID assertions using a BrowserID verification service and
authenticates users. It also provides ``verify``, which lets you build more
complex authentication systems based on BrowserID.

django-browserid is a work in progress. Contributions are welcome. Feel free
to fork_ and contribute!

.. _Django: http://www.djangoproject.com/
.. _BrowserID: https://developer.mozilla.org/en-US/docs/Persona
.. _Persona: https://persona.org
.. _fork: https://github.com/mozilla/django-browserid

.. toctree::
   :maxdepth: 2

   setup
   details/advanced
   details/settings
   details/troubleshooting
   details/api
   details/js_api

Developer Guide
---------------

.. toctree::
   :maxdepth: 1

   dev/devsetup
   dev/changelog
   dev/authors
