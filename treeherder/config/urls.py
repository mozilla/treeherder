from django.conf import settings
from django.urls import include, re_path
from rest_framework.documentation import include_docs_urls

from treeherder.webapp.api import urls as api_urls

urlpatterns = [
    re_path(r'^api/', include(api_urls)),
    re_path(r'^docs/', include_docs_urls(title='REST API Docs')),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        re_path(r'^__debug__/', include(debug_toolbar.urls)),
    ]
