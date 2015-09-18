from django.conf.urls import include, patterns, url
from rest_framework import routers

from treeherder.webapp.schemas import artifacts, pulse_jobs


# schema endpoints:
schema_router = routers.SimpleRouter()
schema_router.register(r'artifacts',
                       artifacts.ArtifactViewSet,
                       base_name="artifact_schema")
schema_router.register(r'pulse/jobs',
                       pulse_jobs.PulseJobsViewSet,
                       base_name="pulse_jobs_schema")

urlpatterns = patterns(
    '',
    url(r'^',
        include(schema_router.urls)),
)
