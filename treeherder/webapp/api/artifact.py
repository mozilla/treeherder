from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_405_METHOD_NOT_ALLOWED

from treeherder.model.derived import ArtifactsModel
from treeherder.webapp.api import permissions


class ArtifactViewSet(viewsets.ViewSet):
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    """
    This viewset is responsible for the artifact endpoint.
    """
    def retrieve(self, request, project, pk=None):
        return Response("retrieving job artifacts is no longer supported",
                        status=HTTP_405_METHOD_NOT_ALLOWED)

    def list(self, request, project):
        return Response("retrieving job artifacts is no longer supported",
                        status=HTTP_405_METHOD_NOT_ALLOWED)

    def create(self, request, project):
        serialized_artifacts = ArtifactsModel.serialize_artifact_json_blobs(
            request.data)
        with ArtifactsModel(project) as artifacts_model:
            artifacts_model.load_job_artifacts(serialized_artifacts)

        return Response({'message': 'Artifacts stored successfully'})
