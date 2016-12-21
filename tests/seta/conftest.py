import pytest
from django.utils import timezone

from treeherder.seta.common import job_priority_index
from treeherder.seta.models import (DEFAULT_LOW_PRIORITY,
                                    DEFAULT_TIMEOUT,
                                    JobPriority,
                                    TaskRequest)
from treeherder.seta.update_job_priority import _sanitize_data


@pytest.fixture
def runnable_jobs_data():
    # The first platform only runs on Buildbot
    # The next two are running in both Buildbot and TaskCluster
    # The last platform is disregarded since it is a build job
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
    tr = TaskRequest(
        repository=test_repository,
        counter=1,
        last_reset=timezone.now(),
        reset_delta=DEFAULT_TIMEOUT,
    )
    tr.save()
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
    JobPriority().store_job_priority_data(job_priority_list)
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
            priority=1,
            timeout=0,
        ))
        # Mark a TC job as low priority
        if datum['testtype'] == 'reftest-e10s-2':
            jp_list[-1].priority = DEFAULT_LOW_PRIORITY
            jp_list[-1].timeout = DEFAULT_TIMEOUT
        # Mark a BB job as low priority
        if datum['testtype'] == 'web-platform-tests-1':
            jp_list[-1].priority = DEFAULT_LOW_PRIORITY
            jp_list[-1].timeout = DEFAULT_TIMEOUT

    return jp_list


@pytest.fixture
def jp_index_fixture(job_priority_list):
    return job_priority_index(job_priority_list)


@pytest.fixture
def failures_fixed_by_commit():
    return {u'you look like a man-o-lantern': [
        (u'39643b5073cfb9473042884bfd3ced0289b3d7dd', u'debug', u'b2g-emu-jb'),
        (u'df822a71f7727bf3cb6d3b2aeba970d8a6d33ea1', u'opt', u'b2g-emu-jb'),
        (u'1824f3350e2152d3272de09c8ec9b103cd3ad667', u'debug', u'osx-10-6'),
        (u'58cab069cf08211159774de948094dd963fb9d44', u'debug', u'osx-10-7'),
        (u'f2e06a487b304c16843fe53782a5888e5582be6b', u'debug', u'windows7-32'),
        (u'fe762310e2f921b93df828ac68ee958f19e2d759', u'debug', u'windows8-32'),
        (u'8d63b645c221e45ccf4a2fbc087fa0088535042c', u'debug', u'windowsxp'),
        (u'93e11a88ea92cfa4d930072b22afca002c53f249', u'opt', u'b2g-device-image'),
        (u'39643b5073cfb9473042884bfd3ced0289b3d7dd', u'debug', u'b2g-emu-jb'),
        (u'2c057fb1cd2b6f8bd74121238d0287063d8f5562', u'opt', u'b2g-device-image')]}
