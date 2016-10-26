from django.conf import settings
from django.conf.urls import (include,
                              url)
from treeherder.webapp.admin import admin_site

from treeherder.credentials.urls import urlpatterns as credentials_patterns
from treeherder.embed import urls as embed_urls
from treeherder.webapp.api import urls as api_urls
from treeherder.webapp.views import LoginView

urlpatterns = [
   url(r'^api/', include(api_urls)),
   # url(r'^accounts/login/$', LoginView.as_view(), name='persona_login'),
   url(r'^embed/', include(embed_urls)),
   url(r'^admin/', include(admin_site.urls)),
   url(r'^docs/', include('rest_framework_swagger.urls')),
   url(r'^credentials/', include(credentials_patterns)),
   # url(r'', include('django_browserid.urls')),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        url(r'^__debug__/', include(debug_toolbar.urls)),
    ]
