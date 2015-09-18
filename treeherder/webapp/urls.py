from django.conf.urls import include, patterns, url
from django.contrib import admin
from django_browserid.admin import site as browserid_admin

from treeherder.embed import urls as embed_urls
from treeherder.webapp.schemas import urls as schema_urls
from treeherder.webapp.api import urls as api_urls

browserid_admin.copy_registry(admin.site)

urlpatterns = patterns('',
                       url(r'^api/', include(api_urls)),
                       url(r'^schemas/', include(schema_urls)),
                       url(r'^embed/', include(embed_urls)),
                       url(r'^admin/', include(browserid_admin.urls)),
                       url(r'^docs/', include('rest_framework_swagger.urls')),
                       url(r'', include('django_browserid.urls')),
                       )
