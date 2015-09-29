from django.conf.urls import (patterns,
                              url)

from .views import ResultsetStatusView

urlpatterns = patterns(
    '',
    url(r'^resultset-status/(?P<repository>[\w-]{0,50})/(?P<revision>\w+)/$',
        ResultsetStatusView.as_view(), name="resultset_status"),
)
