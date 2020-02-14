import logging

from django.core.cache import cache

from treeherder.etl.runnable_jobs import list_runnable_jobs
from treeherder.seta.common import unique_key
from treeherder.seta.models import JobPriority
from treeherder.seta.settings import (SETA_REF_DATA_NAMES_CACHE_TIMEOUT,
                                      SETA_SUPPORTED_TC_JOBTYPES,
                                      SETA_UNSUPPORTED_PLATFORMS,
                                      SETA_UNSUPPORTED_TESTTYPES)

logger = logging.getLogger(__name__)


def is_job_blacklisted(testtype):
    if not testtype:
        return True
    return testtype in SETA_UNSUPPORTED_TESTTYPES


def parse_testtype(build_system_type, job_type_name, platform_option, ref_data_name):
    '''
                       Buildbot       Taskcluster
                       -----------    -----------
    build_system_type  buildbot       taskcluster
    job_type_name      Mochitest      task label
    platform_option    debug,opt,pgo  debug,opt,pgo
    ref_data_name      buildername    task label OR signature hash
    '''
    # XXX: Figure out how to ignore build, lint, etc. jobs
    # https://bugzilla.mozilla.org/show_bug.cgi?id=1318659
    if build_system_type == 'buildbot':
        # The testtype of builbot job can been found in 'ref_data_name'
        # like web-platform-tests-4 in "Ubuntu VM 12.04 x64 mozilla-inbound
        # opt test web-platform-tests-4"
        return ref_data_name.split(' ')[-1]
    else:
        # NOTE: Buildbot bridge tasks always have a Buildbot job associated to it. We will
        #       ignore any BBB task since we will be analyzing instead the Buildbot job associated
        #       to it. If BBB tasks were a production system and there was a technical advantage
        #       we could look into analyzing that instead of the BB job.
        if job_type_name.startswith(tuple(SETA_SUPPORTED_TC_JOBTYPES)):
            # we should get "jittest-3" as testtype for a job_type_name like
            # test-linux64/debug-jittest-3
            return transform(job_type_name.split('-{buildtype}'.
                             format(buildtype=platform_option))[-1])


def transform(testtype):
    '''
    A lot of these transformations are from tasks before task labels and some of them are if we
    grab data directly from Treeherder jobs endpoint instead of runnable jobs API.
    '''
    # XXX: Evaluate which of these transformations are still valid
    if testtype.startswith('[funsize'):
        return None

    testtype = testtype.split('/opt-')[-1]
    testtype = testtype.split('/debug-')[-1]

    # this is plain-reftests for android
    testtype = testtype.replace('plain-', '')

    testtype = testtype.strip()

    # https://bugzilla.mozilla.org/show_bug.cgi?id=1313844
    testtype = testtype.replace('browser-chrome-e10s', 'e10s-browser-chrome')
    testtype = testtype.replace('devtools-chrome-e10s', 'e10s-devtools-chrome')
    testtype = testtype.replace('[TC] Android 4.3 API15+ ', '')

    # mochitest-gl-1 <-- Android 4.3 armv7 API 15+ mozilla-inbound opt test mochitest-gl-1
    # mochitest-webgl-9  <-- test-android-4.3-arm7-api-15/opt-mochitest-webgl-9
    testtype = testtype.replace('webgl-', 'gl-')

    return testtype


def valid_platform(platform):
    # We only care about in-tree scheduled tests and ignore out of band system like autophone.
    return platform not in SETA_UNSUPPORTED_PLATFORMS


def job_priorities_to_jobtypes():
    jobtypes = []
    for jp in JobPriority.objects.all():
        jobtypes.append(jp.unique_identifier())

    return jobtypes


# The only difference between projects is that their list will be based
# on their own specific runnable_jobs.json artifact
def get_reference_data_names(project="autoland", build_system="taskcluster"):
    '''
    We want all reference data names for every task that runs on a specific project.

    For example: "test-linux64/opt-mochitest-webgl-e10s-1"
    '''
    # we cache the reference data names in order to reduce API calls
    cache_key = '{}-{}-ref_data_names_cache'.format(project, build_system)
    ref_data_names_map = cache.get(cache_key)
    if ref_data_names_map:
        return ref_data_names_map

    logger.debug("We did not hit the cache.")
    # cache expired so re-build the reference data names map; the map
    # contains the ref_data_name of every Treeherder task for this project
    ignored_jobs = []
    ref_data_names = {}

    runnable_jobs = list_runnable_jobs(project)

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

    logger.debug('Ignoring %s', ', '.join(sorted(ignored_jobs)))

    # update the cache
    cache.set(cache_key, ref_data_names_map, SETA_REF_DATA_NAMES_CACHE_TIMEOUT)

    return ref_data_names
