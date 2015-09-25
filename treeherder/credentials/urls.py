from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^$', views.CredentialsList.as_view(), name='credentials-list'),
    url(r'create/$', views.CredentialsCreate.as_view(), name='credentials-create'),
    url(r'(?P<pk>[0-9]+)/$', views.CredentialsDetail.as_view(), name='credentials-detail'),
    url(r'(?P<pk>[0-9]+)/delete/$', views.CredentialsDelete.as_view(), name='credentials-delete'),
]
