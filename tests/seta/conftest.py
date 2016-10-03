import pytest
from django.utils import timezone

from treeherder.seta.common import db_map
from treeherder.seta.models import (DEFAULT_LOW_PRIORITY,
                                    DEFAULT_TIMEOUT,
                                    JobPriority,
                                    TaskRequest)
from treeherder.seta.update_job_priority import ManageJobPriorityTable


@pytest.fixture
def task_request(test_repository):
    # test_repository reprents mozilla-central
    # XXX: save to database
    return TaskRequest(
        repository=test_repository,
        counter=1,
        last_reset=timezone.now(),
        reset_delta=DEFAULT_TIMEOUT,
    )


@pytest.fixture
def sanitized_data(runnable_jobs_data):
    return ManageJobPriorityTable().sanitized_data(runnable_jobs_data)


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
        # Mark the TC job as low priority
        if datum['testtype'] == 'reftest-e10s-2':
            jp_list[-1].priority = DEFAULT_LOW_PRIORITY
            jp_list[-1].timeout = DEFAULT_TIMEOUT
        # Mark the BB job as low priority
        if datum['testtype'] == 'web-platform-tests-1':
            jp_list[-1].priority = DEFAULT_LOW_PRIORITY
            jp_list[-1].timeout = DEFAULT_TIMEOUT

    return jp_list


@pytest.fixture
def db_map_fixture(job_priority_list):
    return db_map(job_priority_list)


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
