API
===

Template Helpers
----------------

.. autofunction:: django_browserid.helpers.browserid_login

.. autofunction:: django_browserid.helpers.browserid_logout

.. autofunction:: django_browserid.helpers.browserid_js

.. autofunction:: django_browserid.helpers.browserid_css


Admin Site
----------

.. autoclass:: django_browserid.admin.BrowserIDAdminSite
   :members: include_password_form, copy_registry

.. autodata:: django_browserid.admin.site
   :annotation:


Verification
------------

.. autoclass:: django_browserid.RemoteVerifier
   :members: verify

.. autoclass:: django_browserid.MockVerifier
   :members: __init__, verify

.. autoclass:: django_browserid.VerificationResult
   :members: expires

.. autofunction:: django_browserid.get_audience


Views
-----

.. autoclass:: django_browserid.views.Verify
   :members:
   :show-inheritance:

.. autoclass:: django_browserid.views.Logout
   :members:
   :show-inheritance:

.. autoclass:: django_browserid.views.Info
   :members:
   :show-inheritance:


Signals
-------

.. automodule:: django_browserid.signals
   :members:


Exceptions
----------

.. autoexception:: django_browserid.base.BrowserIDException
   :members:
