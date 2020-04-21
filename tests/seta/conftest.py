import pytest

from treeherder.model.models import Job, JobNote
from treeherder.seta.common import job_priority_index
from treeherder.seta.models import JobPriority
from treeherder.seta.settings import SETA_HIGH_VALUE_PRIORITY, SETA_LOW_VALUE_PRIORITY
from treeherder.seta.update_job_priority import _sanitize_data


@pytest.fixture
def runnable_jobs_data():
    repository_name = 'test_treeherder_jobs'
    runnable_jobs = [
        {
            "build_system_type": "buildbot",
            "job_type_name": "W3C Web Platform Tests",
            "platform": "windows8-64",
            "platform_option": "debug",
            "ref_data_name": "Windows 8 64-bit {} debug test web-platform-tests-1".format(
                repository_name
            ),
        },
        {
            "build_system_type": "buildbot",
            "job_type_name": "Reftest e10s",
            "platform": "linux32",
            "platform_option": "opt",
            "ref_data_name": "Ubuntu VM 12.04 {} opt test reftest-e10s-1".format(repository_name),
        },
        {
            "build_system_type": "buildbot",
            "job_type_name": "Build",
            "platform": "osx-10-7",
            "platform_option": "opt",
            "ref_data_name": "OS X 10.7 {} build".format(repository_name),
        },
        {
            "build_system_type": "taskcluster",
            "job_type_name": "test-linux32/opt-reftest-e10s-1",
            "platform": "linux32",
            "platform_option": "opt",
            "ref_data_name": "test-linux32/opt-reftest-e10s-1",
        },
        {
            "build_system_type": "taskcluster",
            "job_type_name": "test-linux64/opt-reftest-e10s-2",
            "platform": "linux64",
            "platform_option": "opt",
            "ref_data_name": "test-linux64/opt-reftest-e10s-2",
        },
    ]

    return runnable_jobs


@pytest.fixture
def tc_latest_gecko_decision_index(test_repository):
    return {
        "namespace": "gecko.v2.{}.latest.taskgraph.decision".format(test_repository),
        "taskId": "XVDNiP07RNaaEghhvkZJWg",
        "rank": 0,
        "data": {},
        "expires": "2018-01-04T20:36:11.375Z",
    }


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
        jp_list.append(
            JobPriority(
                testtype=datum['testtype'],
                buildtype=datum['platform_option'],
                platform=datum['platform'],
                buildsystem=datum['build_system_type'],
                priority=SETA_HIGH_VALUE_PRIORITY,
            )
        )
        # Mark the reftest-e10s-2 TC job as low priority (unique to TC)
        if datum['testtype'] == 'reftest-e10s-2':
            jp_list[-1].priority = SETA_LOW_VALUE_PRIORITY
        # Mark the web-platform-tests-1 BB job as low priority (unique to BB)
        if datum['testtype'] == 'web-platform-tests-1':
            jp_list[-1].priority = SETA_LOW_VALUE_PRIORITY

    return jp_list


@pytest.fixture
def jp_index_fixture(job_priority_list):
    return job_priority_index(job_priority_list)


@pytest.fixture
def fifteen_jobs_with_notes(
    eleven_jobs_stored, taskcluster_jobs_stored, test_user, failure_classifications
):
    """provide 15 jobs with job notes."""
    counter = 0
    for job in Job.objects.all():
        counter += 1

        # add 5 valid job notes related to 'this is revision x'
        if counter < 6:
            JobNote.objects.create(
                job=job, failure_classification_id=2, user=test_user, text="this is revision x"
            )
            continue

        # add 3 valid job notes with raw revision 31415926535
        if counter < 9:
            JobNote.objects.create(
                job=job, failure_classification_id=2, user=test_user, text="314159265358"
            )
            continue

        # Add 3 job notes with full url to revision, expected to map to 31415926535
        if counter < 12:
            JobNote.objects.create(
                job=job,
                failure_classification_id=2,
                user=test_user,
                text="http://hg.mozilla.org/mozilla-central/314159265358",
            )
            continue

        # Add 1 valid job with trailing slash, expected to map to 31415926535
        if counter < 13:
            JobNote.objects.create(
                job=job,
                failure_classification_id=2,
                user=test_user,
                text="http://hg.mozilla.org/mozilla-central/314159265358/",
            )
            continue

        # Add 1 job with invalid revision text, expect it to be ignored
        if counter < 14:
            # We will ignore this based on text length
            JobNote.objects.create(
                job=job, failure_classification_id=2, user=test_user, text="too short"
            )
            continue

        # Add 1 job with no revision text, expect it to be ignored
        if counter < 15:
            # We will ignore this based on blank note
            JobNote.objects.create(job=job, failure_classification_id=2, user=test_user, text="")
            continue

        # Add 1 more job with invalid revision text, expect it to be ignored
        if counter < 16:
            # We will ignore this based on effectively blank note
            JobNote.objects.create(job=job, failure_classification_id=2, user=test_user, text="/")
            continue

        # if we have any more jobs defined it will break this test, ignore
        continue


@pytest.fixture
def failures_fixed_by_commit():
    # We expect 'windows8-32', 'windowsxp' and 'osx-10-7' jobs to be excluded because those
    # platforms are currently unsupported SETA platforms (see treeherder/seta/settings.py)
    # Also we expect any jobs with invalid job notes to be excluded
    return {
        u'this is revision x': [
            (u'b2g_mozilla-release_emulator-jb-debug_dep', u'debug', u'b2g-emu-jb'),
            (u'b2g_mozilla-release_emulator-jb_dep', u'opt', u'b2g-emu-jb'),
            (u'mochitest-browser-chrome', u'debug', u'osx-10-6'),
            (u'mochitest-browser-chrome', u'debug', u'windows7-32'),
        ],
        u'314159265358': [
            (u'b2g_mozilla-release_emulator-jb-debug_dep', u'debug', u'b2g-emu-jb'),
            (u'b2g_mozilla-release_emulator-debug_dep', u'debug', u'b2g-emu-ics'),
            (u'b2g_mozilla-release_inari_dep', u'opt', u'b2g-device-image'),
            (u'b2g_mozilla-release_nexus-4_dep', u'opt', u'b2g-device-image'),
            (u'mochitest-devtools-chrome-3', u'debug', u'linux64'),
        ],
    }


@pytest.fixture
def patched_seta_fixed_by_commit_repos(monkeypatch, test_repository):
    patched = [test_repository.name]
    monkeypatch.setattr("treeherder.seta.analyze_failures.SETA_FIXED_BY_COMMIT_REPOS", patched)
    return patched
