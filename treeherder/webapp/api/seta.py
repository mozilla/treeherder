from rest_framework import (serializers,
                            status,
                            viewsets)
from rest_framework.response import Response
from treeherder.seta.models import JobPriority
from treeherder.seta.job_priorities import (SetaError,
                                            seta_job_scheduling)


class SetaJobPrioritySerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = JobPriority


class SetaJobPriorityViewSet(viewsets.ViewSet):
    def list(self, request, project):
        # XXX: At the moment we're not taking advantage of "per-project" approach since
        #      SETA currently treats all requests as if it was mozilla-inbound
        build_system_type = request.query_params.get('build_system_type', '*')
        priority = request.query_params.get('priority', 5)
        user_agent = request.META.get('HTTP_USER_AGENT')

        try:
            return Response(seta_job_scheduling(project, build_system_type, priority, user_agent))
        except SetaError as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)
