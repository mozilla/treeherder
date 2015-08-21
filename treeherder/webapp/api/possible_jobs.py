from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.webapp.api.utils import with_jobs
from treeherder.webapp.api import permissions


class PossibleJobsViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the possible_jobs endpoint.

    """
    throttle_scope = 'jobs'
    permission_classes = (permissions.HasLegacyOauthPermissionsOrReadOnly,)

    def list(self, request, project):
        """
        GET method implementation for list of all possible buildbot jobs
        """
        # TODO: fetch from job model
        pass

    @with_jobs
    def create(self, request, project, jm):
        """
        This method adds a new possible job to our table.
        """
        jm.store_possible_job_data(request.DATA)

        return Response({'message': 'Possible job successfully updated'})
