# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.conf import settings
from django.conf.urls import patterns, include, url
from django.views.generic import RedirectView
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

from .api import urls as api_urls
from treeherder.embed import urls as embed_urls

from django_browserid.admin import site as browserid_admin
browserid_admin.copy_registry(admin.site)

urlpatterns = patterns('',
                       url(r'^api/', include(api_urls)),
                       url(r'^embed/', include(embed_urls)),
                       )

urlpatterns += patterns('',
                        url(r'^admin/', include(browserid_admin.urls)),
                        url(r'^docs/', include('rest_framework_swagger.urls')),
                        url(r'', include('django_browserid.urls')),
                        # Redirect all requests on / to /index.html, where they
                        # will be served by WhiteNoise.
                        url(r'^$', RedirectView.as_view(url='index.html'))
                        )

if settings.DEBUG:
    # Add the patterns needed so static files can be viewed without running
    # collectstatic, even when using gunicorn instead of runserver.
    urlpatterns += staticfiles_urlpatterns()
