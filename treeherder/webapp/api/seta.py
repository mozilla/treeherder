from rest_framework import (serializers,
                            status,
                            viewsets)
from rest_framework.response import Response

from treeherder.seta.analyze_failures import get_failures_fixed_by_commit
from treeherder.seta.job_priorities import (SetaError,
                                            seta_job_scheduling)
from treeherder.seta.models import JobPriority
from treeherder.seta.seta import get_distinct_tuples


class SetaJobPrioritySerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = JobPriority


class SetaJobPriorityViewSet(viewsets.ViewSet):
    def list(self, request, project):
        ''' Routing to /api/project/{project}/seta/v1/job-priorities/

        This API can potentially have these consumers:
            * Buildbot
              * build_system_type=buildbot
              * priority=5
              * format=json
            * TaskCluster (Gecko decision task)
              * build_system_type=taskcluster
              * format=json
              * user agent == 'TaskCluster'
        '''
        # XXX: At the moment we're not taking advantage of "per-project" approach since
        #      SETA currently treats all requests as if it was mozilla-inbound
        build_system_type = request.query_params.get('build_system_type', '*')
        priority = request.query_params.get('priority', 5)
        user_agent = request.META.get('HTTP_USER_AGENT')

        try:
            return Response(seta_job_scheduling(project, build_system_type, priority, user_agent))
        except SetaError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)


class SetaFailuresFixedByCommit(viewsets.ViewSet):
    def list(self, request):
        ''' Routing to /api/seta/v1/failures-fixed-by-commit/

        Returns jobs annotated with fixed by commit (no empty string) grouped by
        annotation text (generally a revision that fixes the issue).

        NOTE: This API is not necessary for SETA's normal functioning. It is for feature parity and inspection.
        '''
        return Response({'failures': get_failures_fixed_by_commit()})


class SetaJobTypes(viewsets.ViewSet):
    def list(self, request, project):
        ''' Routing to /api/project/{project}/seta/v1/job-types/

        Returns all distinct jobtypes for a project.

        NOTE: This API is not necessary for SETA's normal functioning. It is for feature parity and inspection.
        '''
        return Response({'jobtypes': get_distinct_tuples(project)})
