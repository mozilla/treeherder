# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import viewsets
from rest_framework.response import Response
from treeherder.webapp.api.utils import UrlQueryFilter, oauth_required
from treeherder.model.derived import JobsModel, ArtifactsModel
from treeherder.model.tasks import populate_error_summary
from treeherder.model.error_summary import get_artifacts_that_need_bug_suggestions


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
        artifacts = ArtifactsModel.serialize_artifact_json_blobs(request.DATA)

        job_guids = [x['job_guid'] for x in artifacts]
        with JobsModel(project) as jobs_model, ArtifactsModel(project) as artifacts_model:

            job_id_lookup = jobs_model.get_job_ids_by_guid(job_guids)

            artifacts_model.load_job_artifacts(artifacts, job_id_lookup)

            # If a ``text_log_summary`` and ``Bug suggestions`` artifact are
            # posted here together, for the same ``job_guid``, then just load
            # them.  This is how it is done internally in our log parser
            # so there is no delay in creation and the bug suggestions show
            # as soon as the log is parsed.
            #
            # If a ``text_log_summary`` is posted WITHOUT an accompanying
            # ``Bug suggestions`` artifact, then schedule to create it
            # asynchronously so that this api does not take too long.

            tls_list = get_artifacts_that_need_bug_suggestions(artifacts)

            # tls_list will contain all ``text_log_summary`` artifacts that
            # do NOT have an accompanying ``Bug suggestions`` artifact in this
            # current list of artifacts.  If it's empty, then we don't need
            # to schedule anything.
            if tls_list:
                populate_error_summary.apply_async(
                    args=[project, tls_list, job_id_lookup],
                    routing_key='error_summary'
                )

            return Response({'message': 'Artifacts stored successfully'})
