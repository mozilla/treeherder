import simplejson as json
from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.model.derived import JobsModel


class ObjectstoreViewSet(viewsets.ViewSet):
    """
    This view is responsible for the objectstore endpoint.
    Only create, list and detail will be implemented.
    Update will not be implemented as JobModel will always do
    a conditional create and then an update.
    """
    def create(self, request, project):
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
