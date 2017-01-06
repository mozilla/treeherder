import logging

from treeherder.seta.common import unique_key
from treeherder.seta.models import JobPriority
from treeherder.seta.runnable_jobs import RunnableJobsClient

LOG = logging.getLogger(__name__)


class Treecodes:
    """This class contain all the mapping we need in SETA and makes it works"""

    def __init__(self, repo_name='mozilla-inbound'):
        # default to query all jobs on mozilla-inbound branch
        self.jobtypes = []
        self.jobnames = []
        ignored_jobs = []

        for job in RunnableJobsClient().query_runnable_jobs(repo_name)['results']:
            # e.g. web-platform-tests-4
            # e.g. Ubuntu VM 12.04 x64 mozilla-inbound opt test web-platform-tests-4 OR
            #      test-linux64/opt-web-platform-tests-4
            testtype = job_testtype(job)
            if self._ignore(testtype):
                ignored_jobs.append(job['ref_data_name'])
                continue

            self.jobtypes.append(
                    unique_key(testtype=testtype,
                               buildtype=job['platform_option'],
                               platform=job['platform']))
            self.jobnames.append({
                'buildplatform': job['build_system_type'],
                'buildtype': job['platform_option'],
                'platform': job['platform'],
                'ref_data_name': job['ref_data_name'],
                'testtype': testtype,
                })

        for ref_data_name in sorted(ignored_jobs):
            LOG.info('Ignoring {}'.format(ref_data_name))

    def _ignore(self, testtype):
        if not testtype:
            return True

        # XXX: This has the danger of falling out of date
        # https://bugzilla.mozilla.org/show_bug.cgi?id=1325369
        for i in ('dep', 'nightly', 'non-unified', 'valgrind', 'build'):
            if testtype.find(i) != -1:
                return True

    def query_jobtypes(self):
        """Query all available jobtypes and return it as list"""
        return self.jobtypes

    def query_jobnames(self):
        """Query all jobnames including buildtype and groupcode, then return them as list"""
        return self.jobnames


def job_testtype(job):
    return parse_testtype(
        build_system_type=job['build_system_type'],
        job_type_name=job['job_type_name'],
        platform_option=job['platform_option'],
        ref_data_name=job['ref_data_name']
    )


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
        if job_type_name.startswith('test-'):
            # we should get "jittest-3" as testtype for a job_type_name like
            # test-linux64/debug-jittest-3
            return transform(job_type_name.split('-{buildtype}'.format(buildtype=platform_option))[-1])


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

    # For testtype to 'build' since that will ensure we ignore these jobs
    # Bug 1318659 - for how mozci could help here
    testtype = testtype.replace(' Opt', 'build')
    testtype = testtype.replace(' Debug', 'build')
    testtype = testtype.replace(' Dbg', 'build')
    testtype = testtype.replace(' (opt)', 'build')
    testtype = testtype.replace(' PGO Opt', 'build')
    testtype = testtype.replace(' Valgrind Opt', 'build')
    testtype = testtype.replace(' Artifact Opt', 'build')
    testtype = testtype.replace(' (debug)', 'build')

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
    # XXX: This can fall out of date
    # https://bugzilla.mozilla.org/show_bug.cgi?id=1325369
    return platform not in [
        'android-4-2-armv7-api15',
        'android-4-4-armv7-api15',
        'android-5-0-armv8-api15',
        'android-5-1-armv7-api15',
        'android-6-0-armv8-api15',
        'osx-10-7',  # Build
        'osx-10-9',
        'osx-10-11',
        'other',
        'taskcluster-images',
        'windows7-64',   # We don't test 64-bit builds on Windows 7 test infra
        'windows8-32',  # We don't test 32-bit builds on Windows 8 test infra
        'Win 6.3.9600 x86_64',
    ]


def job_priorities_to_jobtypes():
    jobtypes = []
    for jp in JobPriority.objects.all():
        jobtypes.append(jp.unique_identifier())

    return jobtypes
