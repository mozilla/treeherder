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


class SetaLowValueJobsViewSet(viewsets.ViewSet):
    def _taskcluster(self, priority=5):
        '''
        TaskCluster sample data
        {
	    "job_type_symbol": "",
	    "platform": "linux64",
	    "buildtype": "opt",
	    "buildplatform": "taskcluster",
	    "name": "mochitest-webgl-e10s-1",
	    "signature": "",
	    "job_group_symbol": "",
	    "job_type_name": "mochitest",
	    "ref_data_name": "desktop-test-linux64/opt-mochitest-webgl-e10s-1",
	    "jobname": ""
	}
        '''
        # XXX: This code can go away when we can query data from runnable jobs API
        jobnames = Treecodes().jobnames_query()
        taskcluster_jobs = {}
        for job in jobnames:
            if job['buildplatform'] == 'taskcluster':
                taskcluster_jobs[unique_key(
                    testtype=job['name'],
                    buildtype=job['buildtype'],
                    platform=job['platform'])] = job['ref_data_name']

        job_priorities = JobPriority.objects.exclude(buildsystem='buildbot')
        if priority:
            job_priorities = job_priorities.filter(priority=priority)

        today = str(datetime.date.today())
        ret = {'jobtypes': {today: []}}
        for job in sorted(job_priorities):
            key = unique_key(testtype=job.testtype, buildtype=job.buildtype, platform=job.platform)
            if key in taskcluster_jobs:
                # e.g. desktop-test-linux64-pgo/opt-reftest-13
                ret['jobtypes'][today].append(taskcluster_jobs[key])

        ret['jobtypes'][today].sort()
        return Response(ret)

    def _buildbot(self):
        '''
        Buildbot sample data
        {
	    "job_type_symbol": "",
	    "platform": "windows8-64",
	    "buildtype": "debug",
	    "buildplatform": "buildbot",
	    "name": "web-platform-tests-1",
	    "signature": "",
	    "job_group_symbol": "",
	    "job_type_name": "web",
	    "ref_data_name": "Windows 8 64-bit mozilla-inbound debug test web-platform-tests-1",
	    "jobname": ""
        }
        '''
        job_priorities = JobPriority.objects.exclude(
            buildsystem='taskcluster').filter(priority=5)

        today = str(datetime.date.today())
        ret = {'jobtypes': {today: []}}
        for job in job_priorities:
            # XXX: This is not really the data Buildbot wants. This is just for now
            # e.g. web-platform-tests-e10s vs Windows 7 VM 32-bit mozilla-inbound debug test marionette-e10s
            ret['jobtypes'][today].append(job.testtype)

        return Response(ret)

    def list(self, request, format=None):
        build_system_type = request.query_params.get('build_system_type', '*')
        priority = request.query_params.get('priority')

        if build_system_type not in ('buildbot', 'taskcluster', '*'):
            error_message = 'Valid build_system_type values are buildbot or taskcluster.'
            return Response(error_message, status=status.HTTP_400_BAD_REQUEST)

        if build_system_type == 'buildbot':
            return self._buildbot()
        else:
            return self._taskcluster(priority=priority)
