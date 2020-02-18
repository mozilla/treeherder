import datetime
import logging

from treeherder.etl.seta import (get_reference_data_names,
                                 is_job_blacklisted,
                                 valid_platform)
from treeherder.seta.models import JobPriority
from treeherder.seta.settings import (SETA_LOW_VALUE_PRIORITY,
                                      SETA_PROJECTS)

logger = logging.getLogger(__name__)


class SetaError(Exception):
    pass


class SETAJobPriorities:
    """
    SETA JobPriority Implementation
    """
    def _process(self, project, build_system, job_priorities):
        '''Return list of ref_data_name for job_priorities'''
        if not job_priorities:
            raise SetaError("Call docker-compose run backend ./manage.py initialize_seta")

        jobs = []

        ref_data_names_map = get_reference_data_names(project, build_system)

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
                logger.warning('Job priority (%s) not found in accepted jobs list', jp)

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

    def seta_job_scheduling(self, project, build_system_type, priority=None):
        self._validate_request(build_system_type, project)
        if build_system_type == 'taskcluster':
            if priority is None:
                priority = SETA_LOW_VALUE_PRIORITY
            job_priorities = []
            for jp in self._query_job_priorities(priority=priority,
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
