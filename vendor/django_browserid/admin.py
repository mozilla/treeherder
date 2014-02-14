# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
from django.contrib.admin.sites import AdminSite


class BrowserIDAdminSite(AdminSite):
    """Support logging in to the admin interface via BrowserID."""
    login_template = 'browserid/admin_login.html'

    #: If True, include the normal username and password form as well as
    #: the BrowserID button.
    include_password_form = False

    def copy_registry(self, site):
        """
        Copy the ModelAdmins that have been registered on another site
        so that they are available on this site as well.

        Useful when used with :func:`django.contrib.admin.autocomplete`,
        allowing you to copy the ModelAdmin entries registered with the
        default site, such as the User ModelAdmin. For example, in
        ``urls.py``:

        .. code-block:: python

           from django.contrib import admin
           admin.autodiscover()

           from django_browserid.admin import site as browserid_admin
           browserid_admin.copy_registry(admin.site)

           # To include: url(r'^admin/', include(browserid_admin.urls))

        :param site:
            Site to copy registry entries from.
        """
        for model, modeladmin in site._registry.items():
            self.register(model, modeladmin.__class__)

    def login(self, request, extra_context=None):
        # Add extra context variables to login view.
        extra_context = extra_context or {}
        extra_context['include_password_form'] = self.include_password_form
        return super(BrowserIDAdminSite, self).login(request, extra_context)


#: Global object for the common case. You can import this in
#: ``admin.py`` and ``urls.py`` instead of
#: :data:`django.contrib.admin.site`.
site = BrowserIDAdminSite()
