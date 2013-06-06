from django.conf.urls import patterns, include, url
from treeherder.webapp.api import views

from rest_framework import routers

# router for views that are bound to a project
# i.e. all those views that don't involve reference data
project_bound_router = routers.DefaultRouter()
project_bound_router.register(r'objectstore', views.ObjectstoreViewSet, base_name='objectstore')

# this is the default router for plain restful endpoints
# we can register refdata endpoints with this router
default_router = routers.DefaultRouter()


urlpatterns = patterns('',
    url(r'^project/(?P<project>\w{0,50})/', include(project_bound_router.urls)),
    url(r'^', include(default_router.urls)),
)
