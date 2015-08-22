from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.webapp.api.utils import get_option, with_jobs
from treeherder.webapp.api import permissions


class PossibleJobsViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the possible_jobs endpoint.

    """
    throttle_scope = 'possible_jobs'
    permission_classes = (permissions.HasLegacyOauthPermissionsOrReadOnly,)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list of all possible buildbot jobs
        """
        results = jm.get_possible_job_list()

        option_collections = jm.refdata_model.get_all_option_collections()
        for job in results:
            job["platform_option"] = get_option(job, option_collections)

        response_body = dict(meta={"repository": project,
                                   "offset": 0,
                                   "count": len(results)},
                             results=results)

        return Response(response_body)

    @with_jobs
    def create(self, request, project, jm):
        """
        This method adds a new possible job to our table.
        """
        jm.store_possible_job_data(request.DATA)

        return Response({'message': 'Possible job successfully updated'})
