from django.conf import settings
from django.conf.urls import include, url
from rest_framework.documentation import include_docs_urls

from treeherder.webapp.api import urls as api_urls

urlpatterns = [
    url(r'^api/', include(api_urls)),
    url(r'^docs/', include_docs_urls(title='REST API Docs')),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        url(r'^__debug__/', include(debug_toolbar.urls)),
    ]
