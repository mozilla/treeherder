from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.model.derived import ArtifactsModel
from treeherder.webapp.api import permissions
from treeherder.webapp.api.utils import UrlQueryFilter


class ArtifactViewSet(viewsets.ViewSet):
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    """
    This viewset is responsible for the artifact endpoint.
    """
    def retrieve(self, request, project, pk=None):
        """
        retrieve a single instance of job_artifact
        """
        filter = UrlQueryFilter({"id": pk})

        with ArtifactsModel(project) as artifactModel:
            objs = artifactModel.get_job_artifact_list(0, 1, filter.conditions)
            if objs:
                return Response(objs[0])
            return Response("job_artifact {0} not found".format(pk), status=HTTP_404_NOT_FOUND)

    def list(self, request, project):
        """
        return a list of job artifacts
        """
        # @todo: remove after old data expires from this change on 3/5/2015
        qparams = request.query_params.copy()
        name = qparams.get('name', None)
        if name and name == 'text_log_summary':
            qparams['name__in'] = 'text_log_summary,Structured Log'
            del(qparams['name'])
        # end remove block

        # @todo: change ``qparams`` back to ``request.query_params``
        filter = UrlQueryFilter(qparams)

        offset = int(filter.pop("offset", 0))
        count = min(int(filter.pop("count", 10)), 1000)

        with ArtifactsModel(project) as artifacts_model:
            objs = artifacts_model.get_job_artifact_list(
                offset,
                count,
                filter.conditions
            )
            return Response(objs)

    def create(self, request, project):
        serialized_artifacts = ArtifactsModel.serialize_artifact_json_blobs(
            request.data)
        with ArtifactsModel(project) as artifacts_model:
            artifacts_model.load_job_artifacts(serialized_artifacts)

        return Response({'message': 'Artifacts stored successfully'})
