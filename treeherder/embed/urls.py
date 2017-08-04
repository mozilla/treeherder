from django.conf.urls import url

from .views import PushStatusView

urlpatterns = [
    url(r'^resultset-status/(?P<repository>[\w-]{0,50})/(?P<revision>\w+)/$',
        PushStatusView.as_view(), name="resultset_status"),

    url(r'^push-status/(?P<repository>[\w-]{0,50})/(?P<revision>\w+)/$',
        PushStatusView.as_view(), name="push_status"),
]
