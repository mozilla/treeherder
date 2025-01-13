from django.conf import settings
from django.urls import include, re_path
from django.views.generic.base import TemplateView

from treeherder.webapp.api import urls as api_urls

urlpatterns = []
# The order is important for the debug toolbar; it needs to be first
# or the panels won't work

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        re_path(r"^__debug__/", include(debug_toolbar.urls)),
    ]

urlpatterns += [
    re_path(r"^api/", include(api_urls)),
    re_path(r"", TemplateView.as_view(template_name="index.html")),
]
