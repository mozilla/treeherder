from django.conf import settings
from django.conf.urls import include, url, re_path
from rest_framework.documentation import include_docs_urls

from treeherder.webapp.api import urls as api_urls
from django.views.generic.base import TemplateView

urlpatterns = [
    url(r'^api/', include(api_urls)),
    url(r'^docs/', include_docs_urls(title='REST API Docs')),
    re_path(r'', TemplateView.as_view(template_name='index.html')),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        url(r'^__debug__/', include(debug_toolbar.urls)),
    ]
