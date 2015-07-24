# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

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
    throttle_scope = 'jobs'

    @with_jobs
    @oauth_required
    def create(self, request, project, jm):
        """
        ::DEPRECATED:: POST method implementation

        TODO: This can be removed when no more clients are using this endpoint.
        Can verify with New Relic

        This copies the exact implementation from the
        /jobs/ create endpoint for backward compatibility with previous
        versions of the Treeherder client and api.
        """
        jm.store_job_data(request.DATA)

        return Response('DEPRECATED: {}  {}: {}'.format(
            "This API will be removed soon.",
            "Please change to using",
            "/api/project/{}/jobs/".format(project)
        ))
