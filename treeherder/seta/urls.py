from django.conf.urls import url

from . import views

app_name = 'seta'
urlpatterns = [
    url(r'^$', views.index, name='index'),
    # XXX Can we have a more meaningful name for this endpoint?
    url(r'^setadetails/$', views.setadetails, name='setadetails'),
]
