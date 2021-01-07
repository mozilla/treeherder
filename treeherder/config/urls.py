from django.conf import settings
from django.urls import include, re_path, path
from rest_framework.documentation import include_docs_urls

from treeherder.webapp.api import urls as api_urls
from django.views.generic.base import TemplateView

def trigger_error(request):
    division_by_zero = 1 / 0

urlpatterns = [
    re_path(r'^api/', include(api_urls)),
    re_path(r'^docs/', include_docs_urls(title='REST API Docs')),
    path('sentry_debug/', trigger_error),
    re_path(r'', TemplateView.as_view(template_name='index.html')),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        re_path(r'^__debug__/', include(debug_toolbar.urls)),
    ]
