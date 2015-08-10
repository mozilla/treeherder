from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.webapp.api.utils import UrlQueryFilter, with_jobs


class PerformanceArtifactViewSet(viewsets.ViewSet):

    """
    This viewset is responsible for the artifact endpoint.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        retrieve a single instance of performance_artifact
        """
        filter = UrlQueryFilter({"id": pk})

        objs = jm.get_performance_artifact_list(0, 1, filter.conditions)
        if objs:
            return Response(objs[0])
        else:
            return Response("performance_artifact {0} not found".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        return a list of job artifacts
        """
        filter = UrlQueryFilter(request.QUERY_PARAMS)

        offset = int(filter.pop("offset", 0))
        count = min(int(filter.pop("count", 10)), 1000)

        objs = jm.get_performance_artifact_list(offset, count, filter.conditions)
        return Response(objs)
