# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import viewsets
from rest_framework.response import Response
from treeherder.webapp.api.utils import UrlQueryFilter, oauth_required
from treeherder.model.derived import JobsModel, ArtifactsModel


class ArtifactViewSet(viewsets.ViewSet):

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
            else:
                return Response("job_artifact {0} not found".format(pk), 404)

    def list(self, request, project):
        """
        return a list of job artifacts
        """
        # @todo: remove after old data expires from this change on 3/5/2015
        qparams = request.QUERY_PARAMS.copy()
        name = qparams.get('name', None)
        if name and name == 'text_log_summary':
            qparams['name__in'] = 'text_log_summary,Structured Log'
            del(qparams['name'])
        # end remove block

        # @todo: change ``qparams`` back to ``request.QUERY_PARAMS``
        filter = UrlQueryFilter(qparams)

        offset = filter.pop("offset", 0)
        count = min(int(filter.pop("count", 10)), 1000)

        with ArtifactsModel(project) as artifacts_model:
            objs = artifacts_model.get_job_artifact_list(
                offset,
                count,
                filter.conditions
            )
            return Response(objs)

    @oauth_required
    def create(self, request, project):

        job_guids = [x['job_guid'] for x in request.DATA]
        with JobsModel(project) as jobsModel, ArtifactsModel(project) as artifacts_model:

            job_id_lookup = jobsModel.get_job_ids_by_guid(job_guids)
            artifacts_model.load_job_artifacts(request.DATA, job_id_lookup)

            return Response({'message': 'Artifacts stored successfully'})
