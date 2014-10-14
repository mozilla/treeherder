JavaScript API
==============

The JavaScript file that comes with django-browserid, ``browserid.js``,
includes a a few public functions that are exposed through the
``django_browserid`` global object.

Most functions return `jQuery Deferreds`_, which allow you to execute code
asynchronously after the login or logout actions finish using a Promise
interface.

.. note:: Most of the JavaScript API depends on the
   :class:`django_browserid.views.Info` view to retrieve some information from
   the backend. It assumes the Info view is available at ``/browserid/info/``
   on your site. If you are having issues with the JavaScript, make sure the
   Info view is available at that URL (typically by ensuring there is no regex
   in front of the django-browserid include in your ``urls.py``).

.. _`jQuery Deferreds`: https://api.jquery.com/jQuery.Deferred/


.. js:function:: django_browserid.login([requestArgs])

   Retrieve an assertion and use it to log the user into your site.

   :param object requestArgs: Options to pass to `navigator.id.request`_.
   :returns: Deferred that resolves once the user has been logged in.

.. _`navigator.id.request`: https://developer.mozilla.org/en-US/docs/DOM/navigator.id.request


.. js:function:: django_browserid.logout()

   Log the user out of your site.

   :returns: Deferred that resolves once the user has been logged out.


.. js:function:: django_browserid.getAssertion([requestArgs])

   Retrieve an assertion via BrowserID.

   :returns: Deferred that resolves with the assertion once it is retrieved.


.. js:function:: django_browserid.verifyAssertion(assertion)

   Verify that the given assertion is valid, and log the user in.

   :param string assertion: Assertion to verify.
   :returns: Deferred that resolves with the login view response once login is
             complete.
