import datetime

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
    def _taskcluster(self):
        return Response(['TODO - taskcluster'])

    def _buildbot(self):
        job_priorities = JobPriority.objects.exclude(buildsystem='buildbot')
        today = str(datetime.date.today())
        ret = {
            'jobtypes': {
                today: []
            }
        }
        for job in job_priorities:
            # XXX: This is not really the data Buildbot wants. This is just for now
            ret['jobtypes'][today].append(job.testtype)

        return Response(ret)

    def list(self, request, format=None):
        build_system_type = request.query_params.get('build_system_type', '*')

        if build_system_type not in ('buildbot', 'taskcluster', '*'):
            error_message = 'Valid build_system_type values are buildbot or taskcluster.'
            return Response(error_message, status=status.HTTP_400_BAD_REQUEST)

        if build_system_type == 'buildbot':
            return self._buildbot()
        else:
            return self._taskcluster()
