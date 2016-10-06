from django.conf import settings
from django.conf.urls import (include,
                              url)
from django.contrib import admin

from treeherder.credentials.urls import urlpatterns as credentials_patterns
from treeherder.embed import urls as embed_urls
from treeherder.webapp.api import urls as api_urls

urlpatterns = [
   url(r'^api/', include(api_urls)),
   url(r'^embed/', include(embed_urls)),
   url(r'^admin/', include(admin.site.urls)),
   url(r'^docs/', include('rest_framework_swagger.urls')),
   url(r'^credentials/', include(credentials_patterns)),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        url(r'^__debug__/', include(debug_toolbar.urls)),
    ]
