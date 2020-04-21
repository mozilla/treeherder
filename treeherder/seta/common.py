import logging
import re

logger = logging.getLogger(__name__)


class DuplicateKeyError(Exception):
    pass


def unique_key(testtype, buildtype, platform):
    '''This makes sure that we order consistently this unique identifier'''
    return (testtype, buildtype, platform)


def job_priority_index(job_priorities):
    '''This structure helps with finding data from the job priorities table'''
    jp_index = {}
    # Creating this data structure which reduces how many times we iterate through the DB rows
    for jp in job_priorities:
        key = jp.unique_identifier()

        # This is guaranteed by a unique composite index for these 3 fields in models.py
        if key in jp_index:
            msg = '"{}" should be a unique job priority and that is unexpected.'.format(key)
            raise DuplicateKeyError(msg)

        # (testtype, buildtype, platform)
        jp_index[key] = {'pk': jp.id, 'build_system_type': jp.buildsystem}

    return jp_index


# The order of this is list is important as the more specific patterns
# will be processed before the less specific ones. This must be kept up
# to date with SETA_SUPPORTED_TC_JOBTYPES in settings.py.
RE_JOB_TYPE_NAMES = [
    {'name': 'test', 'pattern': re.compile('test-[^/]+/[^-]+-(.*)$')},
    {'name': 'desktop-test', 'pattern': re.compile('desktop-test-[^/]+/[^-]+-(.*)$')},
    {'name': 'android-test', 'pattern': re.compile('android-test-[^/]+/[^-]+-(.*)$')},
    {'name': 'source-test', 'pattern': re.compile('(source-test-[^/]+)(?:/.*)?$')},
    {'name': 'build', 'pattern': re.compile('(build-[^/]+)/[^-]+$')},
    {'name': 'spidermonkey', 'pattern': re.compile('(spidermonkey-[^/]+)/[^-]+$')},
    {'name': 'iris', 'pattern': re.compile('(iris-[^/]+)/[^-]+$')},
    {'name': 'webrender', 'pattern': re.compile('(webrender-.*)-(?:opt|debug|pgo)$')},
]


def convert_job_type_name_to_testtype(job_type_name):
    '''job_type_names are essentially free form though there are
    several patterns used in job_type_names.

    test-<platform>/<buildtype>-<testtype> test-linux1804-64-shippable-qr/opt-reftest-e10s-5
    build-<platform>/<buildtype>           build-linux64-asan-fuzzing/opt
    <testtype>-<buildtype>                 webrender-android-hw-p2-debug

    Prior to Bug 1608427, only non-build tasks were eligible for
    optimization using seta strategies and Treeherder's handling of
    possible task labels failed to properly account for the different
    job_type_names possible with build tasks. While investigating this
    failure to support build tasks, it was discovered that other test
    tasks did not match the expected job_type_name pattern. This
    function ensures that job_type_names are converted to seta
    testtypes in a consistent fashion.
    '''
    testtype = None
    if not job_type_name.startswith('[funsize'):
        for re_job_type_name in RE_JOB_TYPE_NAMES:
            m = re_job_type_name['pattern'].match(job_type_name)
            if m:
                testtype = m.group(1)
                break
    if not testtype:
        logger.warning(
            'convert_job_type_name_to_testtype("{}") not matched. '
            'Using job_type_name as is.'.format(job_type_name, testtype)
        )
        testtype = job_type_name
    return testtype
