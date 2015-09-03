from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^$', views.ApplicationList.as_view(), name='application-list'),
    url(r'create/$', views.ApplicationCreate.as_view(), name='application-create'),
    url(r'(?P<pk>[0-9]+)/$', views.ApplicationDetail.as_view(), name='application-detail'),
    url(r'(?P<pk>[0-9]+)/delete/$', views.ApplicationDelete.as_view(), name='application-delete'),
]
