from rest_framework import status, viewsets
from rest_framework.response import Response

from treeherder.seta.job_priorities import SetaError, seta_job_scheduling


class SetaJobPriorityViewSet(viewsets.ViewSet):
    def list(self, request, project):
        ''' Routing to /api/project/{project}/seta/job-priorities/

        This API can potentially have these consumers:
            * Buildbot
              * build_system_type=buildbot
              * priority=5
              * format=json
            * TaskCluster (Gecko decision task)
              * build_system_type=taskcluster
              * format=json
        '''
        build_system_type = request.query_params.get('build_system_type', '*')
        priority = request.query_params.get('priority')
        try:
            return Response(seta_job_scheduling(project, build_system_type, priority))
        except SetaError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)
