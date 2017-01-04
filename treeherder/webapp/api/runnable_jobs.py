from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_500_INTERNAL_SERVER_ERROR

from treeherder.etl.runnable_jobs import list_runnable_jobs


class RunnableJobsViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the runnable_jobs endpoint.

    """

    def list(self, request, project):
        """
        GET method implementation for list of all runnable buildbot jobs
        """
        try:
            return Response(list_runnable_jobs(project, request.query_params.get('decision_task_id')))
        except Exception as ex:
            return Response("Exception: {0}".format(ex), status=HTTP_500_INTERNAL_SERVER_ERROR)
