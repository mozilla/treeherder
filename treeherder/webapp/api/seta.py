import datetime
import logging

from rest_framework import (serializers,
                            status,
                            viewsets)
from rest_framework.response import Response

from treeherder.seta.common import unique_key
from treeherder.seta.jobtypes import Treecodes
from treeherder.seta.models import JobPriority

LOG = logging.getLogger(__name__)


class SetaJobPrioritySerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = JobPriority
        fields = ['testtype']


class SetaJobPriorityViewSet(viewsets.ViewSet):

    def _process(self, project, build_system, exclude, priority=5):
        def _map(build_system):
            '''
            Sample data from Treecodes().jobnames_query() (skipping irrelevant fields)
            {
                "buildplatform": "buildbot",
                "buildtype": "debug",
                "name": "web-platform-tests-1",
                "platform": "windows8-64",
                "ref_data_name": "Windows 8 64-bit mozilla-inbound debug test web-platform-tests-1",
            },{
                "buildplatform": "taskcluster",
                "buildtype": "opt",
                "name": "mochitest-webgl-e10s-1",
                "platform": "linux64",
                "ref_data_name": "desktop-test-linux64/opt-mochitest-webgl-e10s-1",
            }
            '''
            map = {}
            for job in Treecodes().jobnames_query():
                if job['buildplatform'] == build_system:
                    key = unique_key(testtype=job['name'],
                                     buildtype=job['buildtype'],
                                     platform=job['platform'])
                    map[key] = job['ref_data_name']

            return map

        job_priorities = JobPriority.objects.exclude(buildsystem=exclude)
        if priority:
            job_priorities = job_priorities.filter(priority=priority)

        today = str(datetime.date.today())
        ret = {'jobtypes': {today: []}}
        map = _map(build_system)
        for job in job_priorities:
            key = unique_key(testtype=job.testtype, buildtype=job.buildtype, platform=job.platform)
            if key in map:
                # e.g. desktop-test-linux64-pgo/opt-reftest-13 or builder name
                ret['jobtypes'][today].append(map[key])
            LOG.warning('We did not find job priority ({}) in the list of accepted jobs')

        ret['jobtypes'][today].sort()
        return Response(ret)

    def list(self, request, project):
        build_system_type = request.query_params.get('build_system_type', '*')
        exclude = 'taskcluster' if build_system_type == 'buildbot' else 'buildbot'
        priority = request.query_params.get('priority')

        if build_system_type not in ('buildbot', 'taskcluster'):
            error_message = 'Valid build_system_type values are buildbot or taskcluster.'
            return Response(error_message, status=status.HTTP_400_BAD_REQUEST)

        return self._process(project, build_system_type, exclude, priority)
