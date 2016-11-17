import os
import shutil

from django.utils import timezone
import pytest

from treeherder.seta.common import get_root_dir
from treeherder.seta.models import JobPriority
from treeherder.seta.update_job_priority import ManageJobPriorityTable


@pytest.fixture(scope="function")
def test_setup(request):
    path = get_root_dir()
    if os.path.exists(path):
        shutil.rmtree(path)
    yield


@pytest.fixture
def job_priority_table_manager():
    return ManageJobPriorityTable()


@pytest.fixture
def single_job_priority():
    return JobPriority(
        testtype='some-test-1',
        buildtype='opt',
        platform='windows8-64',
        priority=1,
        timeout=5400,
        expiration_date=timezone.now(),
        buildsystem='taskcluster'
    )


DATA = [
    {
        'platform_option': 'debug',
        'platform': 'windows8-64',
        'build_system_type': 'buildbot',
        'testtype': 'web-platform-tests-1'
    }, {
        'platform_option': 'opt',
        'platform': 'linux32',
        'build_system_type': '*',
        'testtype': 'reftest-e10s-1'
    }
]


@pytest.fixture
def sanitized_data():
    return DATA


@pytest.fixture
def all_job_priorities():
    data1 = DATA[0]
    data2 = DATA[1]
    return [
        JobPriority(
            testtype=data1['testtype'],
            buildtype=data1['platform_option'],
            platform=data1['platform'],
            buildsystem=data1['build_system_type'],
        ),
        JobPriority(
            testtype=data2['testtype'],
            buildtype=data2['platform_option'],
            platform=data1['platform'],
            buildsystem=data2['build_system_type'],
        )
    ]


@pytest.fixture
def db_map():
    return {
        ('reftest-e10s-1', 'opt', 'windows8-64'): {
            'pk': None, 'build_system_type': '*'
        },
        ('web-platform-tests-1', 'debug', 'windows8-64'): {
            'pk': None, 'build_system_type': 'buildbot'
        }
    }


@pytest.fixture
def runnable_jobs_data():
    # The first platform only runs on Buildbot
    # The next two are running in both Buildbot and TaskCluster
    # The last platform is disregarded since it is a build job
    return {
        "meta": {
            "count": 4,
            "offset": 0,
            "repository": "mozilla-inbound"
        },
        "results": [
            {
                "build_platform": "windows8-64",
                "build_system_type": "buildbot",
                "job_type_name": "W3C Web Platform Tests",
                "platform": "windows8-64",
                "platform_option": "debug",
                "ref_data_name": "Windows 8 64-bit mozilla-inbound debug test web-platform-tests-1",
            }, {
                "build_platform": "linux32",
                "build_system_type": "taskcluster",
                "job_type_name": "desktop-test-linux32/opt-reftest-e10s-1",
                "platform": "linux64",
                "platform_option": "opt",
                "ref_data_name": "desktop-test-linux32/opt-reftest-e10s-1",
            }, {
                "build_platform": "linux32",
                "build_system_type": "buildbot",
                "job_type_name": "Reftest e10s",
                "platform": "linux32",
                "platform_option": "opt",
                "ref_data_name": "Ubuntu VM 12.04 mozilla-inbound opt test reftest-e10s-1",
            }, {
                "build_platform": "osx-10-7",
                "build_system_type": "buildbot",
                "job_type_name": "Build",
                "platform_option": "opt",
                "ref_data_name": "OS X 10.7 mozilla-inbound build",
            },
        ]
    }
