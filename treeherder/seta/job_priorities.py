import datetime
import logging

from treeherder.config.settings import SETA_LOW_VALUE_PRIORITY
from treeherder.etl.seta import (build_ref_data_names,
                                 is_job_blacklisted,
                                 valid_platform)
from treeherder.model.models import Repository
from treeherder.seta.models import JobPriority

logger = logging.getLogger(__name__)

SETA_PROJECTS = ['mozilla-inbound', 'autoland']


class SetaError(Exception):
    pass


def _process(project, build_system, job_priorities):
    '''Return list of ref_data_name for job_priorities'''
    jobs = []
    # This map contains the ref_data_name of every Treeherder *test* job for this project
    ref_data_names_map = build_ref_data_names(project, build_system)

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
            logger.warning('We did not find job priority ({}) in the list of accepted jobs'.format(jp))

    return jobs


def _gecko_decision_task_request(project):
    ''' SETA called by gecko decision task, return all low value jobs '''
    job_priorities = []
    for jp in _query_job_priorities(priority=SETA_LOW_VALUE_PRIORITY, excluded_build_system_type='buildbot'):
        if jp.has_expired():
            job_priorities.append(jp)

    return _process(project, build_system='taskcluster', job_priorities=job_priorities)


def _query_job_priorities(priority, excluded_build_system_type):
    job_priorities = JobPriority.objects.all()
    if priority:
        job_priorities = job_priorities.filter(priority=priority)
    if excluded_build_system_type:
        job_priorities = job_priorities.exclude(buildsystem=excluded_build_system_type)
    return job_priorities


def _validate_request(build_system_type, project):
    if build_system_type not in ('buildbot', 'taskcluster', '*'):
        raise SetaError('Valid build_system_type values are buildbot or taskcluster.')
    if project not in SETA_PROJECTS:
        raise SetaError("The specified project repo '%s' is not supported by SETA." % project)


def seta_job_scheduling(project, build_system_type, priority=None):
    _validate_request(build_system_type, project)
    if build_system_type == 'taskcluster':
        ref_data_names = _gecko_decision_task_request(project)
    else:
        excluded_build_system_type = None
        if build_system_type != '*':
            excluded_build_system_type = 'taskcluster' if build_system_type == 'buildbot' else 'buildbot'
        job_priorities = _query_job_priorities(priority, excluded_build_system_type)
        ref_data_names = _process(project, build_system_type, job_priorities)

    # We don't really need 'jobtypes' and today's date in the returning data
    # Getting rid of it will require the consumers to not expect it.
    # https://bugzilla.mozilla.org/show_bug.cgi?id=1325405
    return {'jobtypes': {str(datetime.date.today()): sorted(ref_data_names)}}
