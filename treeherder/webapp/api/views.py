import simplejson as json

from django.http import Http404
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import exceptions

from treeherder.model.derived import JobsModel, DatasetNotFoundError


class ObjectstoreViewSet(viewsets.ViewSet):
    """
    This view is responsible for the objectstore endpoint.
    Only create, list and detail will be implemented.
    Update will not be implemented as JobModel will always do
    a conditional create and then an update.
    """

    def create(self, request, project):
        """
        POST method implementation
        """
        try:
            jm = JobsModel(project)
            jm.store_job_data(
                json.dumps(request.DATA),
                request.DATA['job']['job_guid']
            )
            jm.disconnect()
        except Exception as e:
            return Response({"message": str(e)}, status=500)

        return Response({'message': 'well-formed JSON stored'})

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for detail view
        """
        jm = JobsModel(project)
        obj = jm.get_json_blob_by_guid(pk)
        if obj:
            return Response(json.loads(obj[0]['json_blob']))
        else:
            raise Http404()

    def list(self, request, project):
        """
        GET method implementation for list view
        """
        page = request.QUERY_PARAMS.get('page', 0)
        jm = JobsModel(project)
        objs = jm.get_json_blob_list(page, 10)
        return Response([json.loads(obj['json_blob']) for obj in objs])
