from django.conf.urls import (include,
                              url)
from django.contrib import admin
from django_browserid.admin import site as browserid_admin

from treeherder.credentials.urls import urlpatterns as credentials_patterns
from treeherder.embed import urls as embed_urls
from treeherder.webapp.api import urls as api_urls
from treeherder.webapp.views import LoginView

browserid_admin.copy_registry(admin.site)

urlpatterns = [
   url(r'^api/', include(api_urls)),
   url(r'^accounts/login/$', LoginView.as_view(), name='persona_login'),
   url(r'^embed/', include(embed_urls)),
   url(r'^admin/', include(browserid_admin.urls)),
   url(r'^docs/', include('rest_framework_swagger.urls')),
   url(r'^credentials/', include(credentials_patterns)),
   url(r'', include('django_browserid.urls')),
]
