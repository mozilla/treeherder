import json

from rest_framework import viewsets
from rest_framework.response import Response
from treeherder.webapp.api.utils import (with_jobs,
                                         oauth_required)


class ObjectstoreViewSet(viewsets.ViewSet):
    """
    This view is responsible for the objectstore endpoint.
    Only create, list and detail will be implemented.
    Update will not be implemented as JobModel will always do
    a conditional create and then an update.
    """

    @with_jobs
    @oauth_required
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        job_errors_resp = jm.store_job_data(request.DATA)

        resp = {}
        if job_errors_resp:
            resp['message'] = job_errors_resp
            status = 500
        else:
            status = 200
            resp['message'] = 'well-formed JSON stored'

        return Response(resp, status=status)

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view
        """
        obj = jm.get_json_blob_by_guid(pk)
        if obj:
            return Response(json.loads(obj[0]['json_blob']))
        else:
            return Response("No objectstore entry with guid: {0}".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        """
        offset = int(request.QUERY_PARAMS.get('offset', 0))
        count = int(request.QUERY_PARAMS.get('count', 10))
        objs = jm.get_json_blob_list(offset, count)
        return Response([json.loads(obj['json_blob']) for obj in objs])

