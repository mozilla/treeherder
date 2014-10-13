Settings
========

.. module:: django.conf.settings


Core Settings
-------------

.. data:: BROWSERID_AUDIENCES

   **Default:** No default

   List of audiences that your site accepts. An audience is the protocol,
   domain name, and (optionally) port that users access your site from. This
   list is used to determine the audience a user is part of (how they are
   accessing your site), which is used during verification to ensure that the
   assertion given to you by the user was intended for your site.

   Without this, other sites that the user has authenticated with via Persona
   could use their assertions to impersonate the user on your site.

   Note that this does not have to be a publicly accessible URL, so local URLs
   like ``http://localhost:8000`` or ``http://127.0.0.1`` are acceptable as
   long as they match what you are using to access your site.


Redirect URLs
-------------

.. data:: LOGIN_REDIRECT_URL

    **Default:** ``'/accounts/profile'``

    Path to redirect to on successful login. If you don't specify this, the
    default Django value will be used.

.. data:: LOGIN_REDIRECT_URL_FAILURE

    **Default:** ``'/'``

    Path to redirect to on an unsuccessful login attempt.

.. data:: LOGOUT_REDIRECT_URL

   **Default:** ``'/'``

   Path to redirect to on logout.


Customizing the Login Popup
---------------------------

.. data:: BROWSERID_REQUEST_ARGS

   **Default:** ``{}``

   Controls the arguments passed to ``navigator.id.request``, which are used to
   customize the login popup box. To see a list of valid keys and what they do,
   check out the `navigator.id.request documentation`_.

   .. _navigator.id.request documentation: https://developer.mozilla.org/en-US/docs/DOM/navigator.id.request


Customizing the Verify View
---------------------------

.. data:: BROWSERID_VERIFY_VIEW

    **Default:** ``django_browserid.views.Verify``

    Allows you to substitute a custom class-based view for verifying assertions.
    For example, the string 'myapp.users.views.Verify' would import `Verify`
    from `myapp.users.views` and use it in place of the default view.

    When using a custom view, it is generally a good idea to subclass the
    default Verify and override the methods you want to change.

.. data:: BROWSERID_CREATE_USER

    **Default:** ``True``

    If ``True`` or ``False``, enables or disables automatic user creation during
    authentication.

    If set to a string, it is treated as an import path pointing to a custom
    user creation function. See :ref:`auto-user` for more information.

.. data:: BROWSERID_DISABLE_SANITY_CHECKS

    **Default:** False

    Controls whether the ``Verify`` view performs some helpful checks for common
    mistakes. Useful if you're getting warnings for things you know aren't
    errors.


Using a Different Identity Provider
-----------------------------------

.. data:: BROWSERID_SHIM

   **Default:** 'https://login.persona.org/include.js'

   The URL to use for the BrowserID JavaScript shim.
