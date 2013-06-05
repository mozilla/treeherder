from django.conf.urls import patterns, include, url
from treeherder.webapp.api import views


# Wire up our API using automatic URL routing.
# Additionally, we include login URLs for the browseable API.
urlpatterns = patterns('',
    url(r'^project/(?P<project>\w{0,50})/objectstore/(?P<guid>\w{5,50})',
                                        views.job_ingestion, name="job_ingestion_endpoint"),
)
