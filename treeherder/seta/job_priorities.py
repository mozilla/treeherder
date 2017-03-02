import datetime
import logging

from django.core.cache import cache

from treeherder.etl.runnable_jobs import list_runnable_jobs
from treeherder.etl.seta import (is_job_blacklisted,
                                 parse_testtype,
                                 valid_platform)
from treeherder.model.models import Repository
from treeherder.seta.common import unique_key
from treeherder.seta.models import JobPriority
from treeherder.seta.settings import (SETA_LOW_VALUE_PRIORITY,
                                      SETA_PROJECTS,
                                      SETA_REF_DATA_NAMES_CACHE_TIMEOUT)

logger = logging.getLogger(__name__)


class SetaError(Exception):
    pass


class SETAJobPriorities:
    """
    SETA JobPriority Implementation
    """
    def __init__(self):
        self.cache_key = 'ref_data_names_cache'

    def _process(self, project, build_system, job_priorities):
        '''Return list of ref_data_name for job_priorities'''
        jobs = []

        # we cache the reference data names in order to reduce API calls
        ref_data_names_map = cache.get(self.cache_key, 'expired')
        if ref_data_names_map == 'expired':
            # cache expired so re-build the reference data names map; the map
            # contains the ref_data_name of every treeherder *test* job for this project
            ref_data_names_map = self._build_ref_data_names(project, build_system)
            # update the cache
            cache.set(self.cache_key, ref_data_names_map, SETA_REF_DATA_NAMES_CACHE_TIMEOUT)

        # now check the JobPriority table against the list of valid runnable
        for jp in job_priorities:
            # if this JobPriority entry is no longer supported in SETA then ignore it
            if not valid_platform(jp.platform):
                continue
            if is_job_blacklisted(jp.testtype):
                continue

            key = jp.unique_identifier()
            if key in ref_data_names_map:
                # e.g. desktop-test-linux64-pgo/opt-reftest-13 or builder name
                jobs.append(ref_data_names_map[key])
            else:
                logger.warning('Job priority ({}) not found in accepted jobs list'.format(jp))

        return jobs

    def _query_job_priorities(self, priority, excluded_build_system_type):
        job_priorities = JobPriority.objects.all()
        if priority:
            job_priorities = job_priorities.filter(priority=priority)
        if excluded_build_system_type:
            job_priorities = job_priorities.exclude(buildsystem=excluded_build_system_type)
        return job_priorities

    def _validate_request(self, build_system_type, project):
        if build_system_type not in ('buildbot', 'taskcluster', '*'):
            raise SetaError('Valid build_system_type values are buildbot or taskcluster.')
        if project not in SETA_PROJECTS:
            raise SetaError("The specified project repo '%s' is not supported by SETA." % project)

    def _build_ref_data_names(self, project, build_system):
        '''
        We want all reference data names for every task that runs on a specific project.

        For example:
            * Buildbot - "Windows 8 64-bit mozilla-inbound debug test web-platform-tests-1"
            * TaskCluster = "test-linux64/opt-mochitest-webgl-e10s-1"
        '''
        ignored_jobs = []
        ref_data_names = {}

        runnable_jobs = list_runnable_jobs(project)['results']

        for job in runnable_jobs:
            # get testtype e.g. web-platform-tests-4
            testtype = parse_testtype(
                build_system_type=job['build_system_type'],
                job_type_name=job['job_type_name'],
                platform_option=job['platform_option'],
                ref_data_name=job['ref_data_name']
            )

            if not valid_platform(job['platform']):
                continue

            if is_job_blacklisted(testtype):
                ignored_jobs.append(job['ref_data_name'])
                continue

            key = unique_key(testtype=testtype,
                             buildtype=job['platform_option'],
                             platform=job['platform'])

            if build_system == '*':
                ref_data_names[key] = job['ref_data_name']
            elif job['build_system_type'] == build_system:
                ref_data_names[key] = job['ref_data_name']

        for ref_data_name in sorted(ignored_jobs):
            logger.info('Ignoring {}'.format(ref_data_name))

        return ref_data_names

    def seta_job_scheduling(self, project, build_system_type, priority=None):
        self._validate_request(build_system_type, project)
        if build_system_type == 'taskcluster':
            job_priorities = []
            for jp in self._query_job_priorities(priority=SETA_LOW_VALUE_PRIORITY,
                                                 excluded_build_system_type='buildbot'):
                if jp.has_expired():
                    job_priorities.append(jp)
            ref_data_names = self._process(project,
                                           build_system='taskcluster',
                                           job_priorities=job_priorities)
        else:
            excluded_build_system_type = None
            if build_system_type != '*':
                excluded_build_system_type = 'taskcluster' if build_system_type == 'buildbot' else 'buildbot'
            job_priorities = self._query_job_priorities(priority, excluded_build_system_type)
            ref_data_names = self._process(project, build_system_type, job_priorities)

        # We don't really need 'jobtypes' and today's date in the returning data
        # Getting rid of it will require the consumers to not expect it.
        # https://bugzilla.mozilla.org/show_bug.cgi?id=1325405
        return {'jobtypes': {str(datetime.date.today()): sorted(ref_data_names)}}


# create an instance of this class, and expose `seta_job_scheduling`
seta_job_scheduling = SETAJobPriorities().seta_job_scheduling
