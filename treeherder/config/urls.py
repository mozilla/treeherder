from django.conf import settings
from django.urls import include, re_path
from rest_framework.schemas import get_schema_view

from treeherder.webapp.api import urls as api_urls
from django.views.generic.base import TemplateView

urlpatterns = []
# The order is important for the debug toolbar; it needs to be first
# or the panels won't work

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        re_path(r'^__debug__/', include(debug_toolbar.urls)),
    ]

urlpatterns += [
    re_path(r'^api/', include(api_urls)),
    re_path(r'^openapi/', get_schema_view(title='REST API Docs'), name='openapi-schema'),
    re_path(
        r'^docs/',
        TemplateView.as_view(
            template_name='redoc.html', extra_context={'schema_url': 'openapi-schema'}
        ),
    ),
    re_path(r'', TemplateView.as_view(template_name='index.html')),
]
