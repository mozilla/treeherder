import pytest
from django.utils import timezone

from treeherder.config.settings import (SETA_HIGH_VALUE_PRIORITY,
                                        SETA_HIGH_VALUE_TIMEOUT,
                                        SETA_LOW_VALUE_PRIORITY,
                                        SETA_LOW_VALUE_TIMEOUT)
from treeherder.seta.common import job_priority_index
from treeherder.seta.models import (JobPriority,
                                    TaskRequest)
from treeherder.seta.update_job_priority import _sanitize_data


@pytest.fixture
def runnable_jobs_data():
    return {
        "meta": {
            "count": 5,
            "offset": 0,
            "repository": "mozilla-inbound"
        },
        "results": [
            {
                "build_system_type": "buildbot",
                "job_type_name": "W3C Web Platform Tests",
                "platform": "windows8-64",
                "platform_option": "debug",
                "ref_data_name": "Windows 8 64-bit mozilla-inbound debug test web-platform-tests-1",
            }, {
                "build_system_type": "buildbot",
                "job_type_name": "Reftest e10s",
                "platform": "linux32",
                "platform_option": "opt",
                "ref_data_name": "Ubuntu VM 12.04 mozilla-inbound opt test reftest-e10s-1",
            }, {
                "build_system_type": "buildbot",
                "job_type_name": "Build",
                "platform": "osx-10-7",
                "platform_option": "opt",
                "ref_data_name": "OS X 10.7 mozilla-inbound build",
            }, {
                "build_system_type": "taskcluster",
                "job_type_name": "desktop-test-linux32/opt-reftest-e10s-1",
                "platform": "linux32",
                "platform_option": "opt",
                "ref_data_name": "desktop-test-linux32/opt-reftest-e10s-1",
            }, {
                "build_system_type": "taskcluster",
                "job_type_name": "desktop-test-linux64/opt-reftest-e10s-2",
                "platform": "linux64",
                "platform_option": "opt",
                "ref_data_name": "desktop-test-linux64/opt-reftest-e10s-2",
            }
        ]
    }


@pytest.fixture
def task_request_stored(test_repository):
    # test_repository reprents the repository test_treeherder_jobs
    tr = TaskRequest.objects.create(
        repository=test_repository,
        counter=1,
        last_reset=timezone.now(),
        reset_delta=SETA_LOW_VALUE_TIMEOUT,
    )
    return tr


@pytest.fixture
def sanitized_data(runnable_jobs_data):
    return _sanitize_data(runnable_jobs_data)


@pytest.fixture
def all_job_priorities_stored(job_priority_list):
    '''Stores sample job priorities

    If you include this fixture in your tests it will guarantee
    to insert job priority data into the temporary database.
    '''
    for jp in job_priority_list:
        jp.save()

    return job_priority_list


@pytest.fixture
def job_priority_list(sanitized_data):
    jp_list = []
    for datum in sanitized_data:
        jp_list.append(JobPriority(
            testtype=datum['testtype'],
            buildtype=datum['platform_option'],
            platform=datum['platform'],
            buildsystem=datum['build_system_type'],
            priority=SETA_HIGH_VALUE_PRIORITY,
            timeout=SETA_HIGH_VALUE_TIMEOUT,
        ))
        # Mark the reftest-e10s-2 TC job as low priority (unique to TC)
        if datum['testtype'] == 'reftest-e10s-2':
            jp_list[-1].priority = SETA_LOW_VALUE_PRIORITY
            jp_list[-1].timeout = SETA_LOW_VALUE_TIMEOUT
        # Mark the web-platform-tests-1 BB job as low priority (unique to BB)
        if datum['testtype'] == 'web-platform-tests-1':
            jp_list[-1].priority = SETA_LOW_VALUE_PRIORITY
            jp_list[-1].timeout = SETA_LOW_VALUE_TIMEOUT

    return jp_list


@pytest.fixture
def jp_index_fixture(job_priority_list):
    return job_priority_index(job_priority_list)


@pytest.fixture
def failures_fixed_by_commit():
    return {
        u'you look like a man-o-lantern': [
            (u'b2g_mozilla-release_emulator-jb-debug_dep', u'debug', u'b2g-emu-jb'),
            (u'b2g_mozilla-release_emulator-jb_dep', u'opt', u'b2g-emu-jb'),
            (u'mochitest-browser-chrome', u'debug', u'osx-10-6'),
            (u'mochitest-browser-chrome', u'debug', u'osx-10-7'),
            (u'mochitest-browser-chrome', u'debug', u'windows7-32'),
            (u'mochitest-browser-chrome', u'debug', u'windows8-32'),
            (u'mochitest-browser-chrome', u'debug', u'windowsxp'),
            (u'b2g_mozilla-release_inari_dep', u'opt', u'b2g-device-image'),
            (u'b2g_mozilla-release_emulator-jb-debug_dep', u'debug', u'b2g-emu-jb'),
            (u'b2g_mozilla-release_nexus-4_dep', u'opt', u'b2g-device-image')]}
