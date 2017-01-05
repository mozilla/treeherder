import datetime
import logging

from treeherder.etl.seta import Treecodes
from treeherder.model.models import Repository
from treeherder.seta.common import unique_key
from treeherder.seta.models import (JobPriority,
                                    TaskRequest)

RESET_DELTA = 5400

logger = logging.getLogger(__name__)


class SetaError(Exception):
    pass


# XXX: We can get rid of this function if Treecodes took care of it
def _ref_data_names(build_system):
    '''
    Sample data from Treecodes().query_jobnames() (skipping irrelevant fields)
    {
        "buildplatform": "buildbot",
        "buildtype": "debug",
        "platform": "windows8-64",
        "ref_data_name": "Windows 8 64-bit mozilla-inbound debug test web-platform-tests-1",
        "testtype": "web-platform-tests-1",
    },{
        "buildplatform": "taskcluster",
        "buildtype": "opt",
        "platform": "linux64",
        "ref_data_name": "test-linux64/opt-mochitest-webgl-e10s-1",
        "testtype": "mochitest-webgl-e10s-1",
    }
    '''
    ref_data_names = {}
    for job in Treecodes().query_jobnames():
        key = unique_key(testtype=job['testtype'],
                         buildtype=job['buildtype'],
                         platform=job['platform'])
        if build_system == '*':
            ref_data_names[key] = job['ref_data_name']
        elif job['buildplatform'] == build_system:
            ref_data_names[key] = job['ref_data_name']

    return ref_data_names


def _process(build_system, job_priorities):
    '''Return list of ref_data_name for job_priorities'''
    jobs = []
    # This map contains the ref_data_name of every Treeherder job
    ref_data_names = _ref_data_names(build_system)

    for jp in job_priorities:
        if build_system == 'taskcluster':
            # We need to retranslate the jobtype back to the proper data form after all.
            # Bug 1313844 - Name inconsistencies between Buildbot and TaskCluster
            jp.testtype = jp.testtype.replace('e10s-browser-chrome', 'browser-chrome-e10s')
            jp.testtype = jp.testtype.replace('e10s-devtools-chrome', 'devtools-chrome-e10s')
            jp.testtype = jp.testtype.replace('gl-', 'webgl-')

        key = jp.unique_identifier()
        if key in ref_data_names:
            # e.g. desktop-test-linux64-pgo/opt-reftest-13 or builder name
            jobs.append(ref_data_names[key])
        else:
            logger.warning('We did not find job priority ({}) in the list of accepted jobs'.format(jp))

    return jobs


def _gecko_decision_task_request(project):
    # In the case of a request from the Gecko decision task we don't care which priority is
    # requested. We return either all jobs every 5th push or 90 minutes for that project or
    # all TaskCluster high value jobs.
    task_request = _update_task_request(project)
    last_reset = task_request.seconds_since_last_reset()
    job_priorities = []
    for jp in _query_job_priorities(priority=0, excluded_build_system_type='buildbot'):
        # We only add a job if it hasn't reached its timeout.
        # If the timeout is zero it means that the job needs to always run
        if last_reset < jp.timeout or jp.timeout == 0:
            # Due to the priority of all high value jobs is 1, and we
            # We need to return all jobs for every 5th push.
            if task_request.counter % jp.priority != 0:
                job_priorities.append(jp)

    return _process(build_system='taskcluster', job_priorities=job_priorities)


def _update_task_request(project):
    '''Update a repository's counter and/or reset timer.'''
    now = datetime.datetime.now()

    try:
        task_request = TaskRequest.objects.get(repository__name=project)
        # Increase the counter of how many times the gecko decision task
        # has contacted us
        task_request.counter += 1
        if task_request.has_expired():
            task_request.last_reset = now
        task_request.save()
    except TaskRequest.DoesNotExist:
        task_request = TaskRequest.objects.create(
            repository=Repository.objects.get(name=project),
            counter=1,
            last_reset=now,
            reset_delta=RESET_DELTA)

    return task_request


def _query_job_priorities(priority, excluded_build_system_type):
    job_priorities = JobPriority.objects.all()
    if priority != 0:
        job_priorities = job_priorities.filter(priority=priority)
    return job_priorities.exclude(buildsystem=excluded_build_system_type)


def _validate_request(build_system_type, project):
    if build_system_type not in ('buildbot', 'taskcluster', '*'):
        raise SetaError('Valid build_system_type values are buildbot or taskcluster.')


def seta_job_scheduling(project, build_system_type, priority=5, increase_counter=False):
    _validate_request(build_system_type, project)

    if increase_counter:
        ref_data_names = _gecko_decision_task_request(project)
    else:
        excluded_build_system_type = 'taskcluster' if build_system_type == 'buildbot' else 'buildbot'
        job_priorities = _query_job_priorities(priority, excluded_build_system_type)
        ref_data_names = _process(build_system_type, job_priorities)

    # We don't really need 'jobtypes' and today's date in the returning data
    # Getting rid of it will require the consumers to not expect it.
    # https://bugzilla.mozilla.org/show_bug.cgi?id=1325405
    return {'jobtypes': {str(datetime.date.today()): sorted(ref_data_names)}}
