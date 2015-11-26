from django.conf.urls import url

from .views import ResultsetStatusView

urlpatterns = [
    url(r'^resultset-status/(?P<repository>[\w-]{0,50})/(?P<revision>\w+)/$',
        ResultsetStatusView.as_view(), name="resultset_status"),
]
