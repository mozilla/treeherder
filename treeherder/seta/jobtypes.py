import json
import logging

from treeherder.seta.common import get_runnable_jobs_path
from treeherder.seta.update_job_priority import ManageJobPriorityTable

LOG = logging.getLogger(__name__)


def _getgroup(name):
    """It's about to get group for the test job, like crashtest for crashtest-1."""
    try:
        group = name.split('-')[0]
    except:
        group = ''
    return group


def _getgroupCode(tbplnames, name):
    """
    It's about get group code by given testname, like T-e10s for tp5o-e10s.
    And there has some useless blank in testname like " mochitest-devtools-chrome-3"
    to strip that blank off, so we can get the code appropriately.
    """
    try:
        code = tbplnames[name.strip()]['group']
    except:
        code = ''
    return code


def _getcode(tbplnames, name):
    """
    It's about get the code by given testname, it usually related with the group code
    like '2' for web-platform-tests-2.   And there has some useless blank in testname
    like " mochitest-devtools-chrome-3" to strip that blank off,
    so we can get the code appropriately.
    """
    try:
        code = tbplnames[name.strip()]['code']
    except:
        code = ''
    return code


class Treecodes:
    """This class contain all the mapping we need in SETA and make it works"""

    def __init__(self, repo_name='mozilla-inbound'):
        # default to query all jobs on mozilla-inbound branch
        self.tbplnames = {}
        self.jobtypes = []
        self.jobnames = []

        ManageJobPriorityTable().update_job_priority_table()

        with open(get_runnable_jobs_path()) as data:
            joblist = json.loads(data.read())['results']

        for job in joblist:
            # e.g. web-platform-tests-4
            # e.g. Ubuntu VM 12.04 x64 mozilla-inbound opt test web-platform-tests-4 OR
            #      desktop-test-linux64/opt-web-platform-tests-4
            testtype, job_identifier = self._testtype_job_identifier(job)

            # XXX: This has the danger of falling out of date
            if not testtype or 'mulet' in job['platform']:
                LOG.info('Ignoring {}'.format(job['ref_data_name']))
                continue

            # XXX: This has the danger of falling out of date
            for i in ('dep', 'nightly', 'non-unified', 'valgrind', 'build'):
                if testtype.find(i) != -1:
                    LOG.info('Ignoring {}'.format(job['ref_data_name']))
                    continue

            try:
                platform = job['platform']
                buildtype = job['platform_option']
                self.jobtypes.append([platform, buildtype, testtype])

                # It's about get jobnames and both buildbot and taskcluster job has '?'
                # when the job_group_symbol is unknown.
                self.jobnames.append(self._get_jobnames(job, testtype, job_identifier))
                job_group_symbol = job['job_group_symbol'] \
                    if job['job_group_symbol'] != '?' else ''
                job_type_symbol = job['job_type_symbol'] if job['job_type_symbol'] else ''
                self.tbplnames.update({testtype: {'group': job_group_symbol,
                                                  'code': job_type_symbol}})
            except:
                # XXX: shold we simply let the exception bubble up?
                LOG.exception('We failed to initialize.')

    def _testtype_job_identifier(self, job):
        job_identifier = None
        testtype = None

        # the testtype of builbot job can been found in 'ref_data_name'
        # like web-platform-tests-4 in "Ubuntu VM 12.04 x64 mozilla-inbound
        #  opt test web-platform-tests-4"
        if job['build_system_type'] == 'buildbot':
            testtype = job['ref_data_name'].split(' ')[-1]
            job_identifier = job['ref_data_name']

        # taskcluster's testtype is a part of its 'job_type_name' like reftest-2
        # for [TC] Linux64 reftest-2
        elif job['build_system_type'] == 'taskcluster':
            # The test name on taskcluster comes to a sort of combination
            # (e.g desktop-test-linux64/debug-jittests-3) and asan job can
            # been referenced as a opt job.
            # NOTE: jobs like 'MacOSX64 Static Analysis Opt' will be left aside
            # because they are not a test job.
            if job['ref_data_name'].startswith('desktop-test') or \
               job['ref_data_name'].startswith('android-test'):

                # we want the build type(debug or opt) to separate the job_type_name
                # (e.g desktop-test-linux64/debug-jittests-3)
                separator = job['platform_option'] \
                    if job['platform_option'] != 'asan' else 'opt'
                # we should get "jittests-3" as testtype for job_type_name like
                # desktop-test-linux64/debug-jittests-3
                testtype = job['job_type_name'].split(
                    '{buildtype}-'.format(buildtype=separator))[-1]
                job_identifier = job['ref_data_name']

        return testtype, job_identifier

    def jobtype_query(self):
        """Query all available jobtypes and return it as list"""
        return self.jobtypes

    def jobnames_query(self):
        """Query all jobnames including buildtype and groupcode, then return them as list"""
        return self.jobnames

    def _get_jobnames(self, job, testtype, job_identifier):
        signature = ''  # TH specific
        buildplatform = job['build_system_type']
        buildtype = job['platform_option']
        platform = job['platform']
        name = testtype
        jobname = ''  # TH specific
        job_identifier = job_identifier
        group = _getgroup(name)
        groupcode = _getgroupCode(self.tbplnames, name)
        code = _getcode(self.tbplnames, name)
        data = {'buildplatform': buildplatform, 'jobname': jobname, 'signature': signature,
                'job_type_name': group, 'job_group_symbol': groupcode,
                'name': name, 'job_type_symbol': code,
                'ref_data_name': job_identifier,
                'platform': platform, 'buildtype': buildtype}
        return data
