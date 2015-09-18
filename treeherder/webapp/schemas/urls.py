from django.conf.urls import include, patterns, url
from rest_framework import routers

from treeherder.webapp.schemas import artifacts


# schema endpoints:
schema_router = routers.SimpleRouter()
schema_router.register(r'artifacts',
                       artifacts.ArtifactViewSet,
                       base_name="artifact_schema")

urlpatterns = patterns(
    '',
    url(r'^',
        include(schema_router.urls)),
)
