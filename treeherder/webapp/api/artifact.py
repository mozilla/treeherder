# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import viewsets
from rest_framework.response import Response
from treeherder.webapp.api.utils import (UrlQueryFilter, with_jobs,
                                         oauth_required)


class ArtifactViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the artifact endpoint.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        retrieve a single instance of job_artifact
        """
        filter = UrlQueryFilter({"id": pk})

        objs = jm.get_job_artifact_list(0, 1, filter.conditions)
        if objs:
            return Response(objs[0])
        else:
            return Response("job_artifact {0} not found".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        return a list of job artifacts
        """
        filter = UrlQueryFilter(request.QUERY_PARAMS)

        offset = filter.pop("offset", 0)
        count = min(int(filter.pop("count", 10)), 1000)

        objs = jm.get_job_artifact_list(offset, count, filter.conditions)
        return Response(objs)

    @with_jobs
    @oauth_required
    def create(self, request, project, jm):

        job_guids = [x['job_guid'] for x in request.DATA]
        job_id_lookup = jm.get_job_ids_by_guid(job_guids)

        jm.load_job_artifacts(request.DATA, job_id_lookup)

        return Response({'message': 'Artifacts stored successfully'})
