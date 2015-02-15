# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.conf import settings
from django.conf.urls import patterns, include, url
from django.views.generic import RedirectView
from django.contrib import admin

from .api import urls as api_urls
from treeherder.embed import urls as embed_urls

admin.autodiscover()

from django_browserid.admin import site as browserid_admin
browserid_admin.copy_registry(admin.site)

urlpatterns = patterns('',
                       url(r'^api/', include(api_urls)),
                       url(r'^embed/', include(embed_urls)),
                       )

# make swagger available only if it's installed in INSTALLED_APPS
if 'rest_framework_swagger' in settings.INSTALLED_APPS:
    urlpatterns += patterns('',
                            url(r'^docs/', include('rest_framework_swagger.urls')),
                            )

urlpatterns += patterns('',
                        url(r'^admin/', include(browserid_admin.urls)),
                        url(r'', include('django_browserid.urls')),
                        # by default redirect all request on / to /ui/
                        url(r'^$', RedirectView.as_view(url='/ui/'))
                        )
