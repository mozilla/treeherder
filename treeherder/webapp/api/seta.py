from rest_framework import (serializers,
                            status,
                            viewsets)
from rest_framework.response import Response

from treeherder.seta.models import JobPriority


class SetaJobPrioritySerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = JobPriority
        fields = ['testtype']

class SetaLowValueJobsViewSet(viewsets.ViewSet):
    def list(self, request, format=None):
        build_system_type = request.query_params.get('build_system_type', '*')

        if build_system_type not in ('buildbot', 'taskcluster', '*'):
            error_message = 'Valid build_system_type values are buildbot, taskcluster or *'
            return Response(error_message, status=status.HTTP_400_BAD_REQUEST)

        ret = [build_system_type]

        return Response(ret)
