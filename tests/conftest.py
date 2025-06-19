import copy
import datetime
import json
import os
import platform
import time
from os.path import dirname, join
from unittest.mock import MagicMock

import kombu
import moz_measure_noise
import pytest
import responses
import yaml
from _pytest.monkeypatch import MonkeyPatch
from django.conf import settings
from django.core.management import call_command
from rest_framework.test import APIClient

import treeherder.etl.bugzilla
from tests.autoclassify.utils import (
    create_failure_lines,
    create_text_log_errors,
    test_line,
)
from treeherder.etl.jobs import store_job_data
from treeherder.etl.push import store_push_data
from treeherder.model import models as th_models
from treeherder.perf import models as perf_models
from treeherder.services import taskcluster
from treeherder.services.pulse.exchange import get_exchange
from treeherder.webapp.api import perfcompare_utils

IS_WINDOWS = "windows" in platform.system().lower()
SAMPLE_DATA_PATH = join(dirname(__file__), "sample_data")


def pytest_addoption(parser):
    parser.addoption(
        "--runslow",
        action="store_true",
        help="run slow tests",
    )


def pytest_runtest_setup(item):
    """
    Per-test setup.
    - Add an option to run those tests marked as 'slow'
    - Clear the django cache between runs
    """

    if "slow" in item.keywords and not item.config.getoption("--runslow"):
        pytest.skip("need --runslow option to run")

    from django.core.cache import cache

    cache.clear()


@pytest.fixture
def setup_repository_data(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        call_command("loaddata", join(SAMPLE_DATA_PATH, "repository_group.json"))
    with django_db_blocker.unblock():
        call_command("loaddata", join(SAMPLE_DATA_PATH, "repository.json"))


@pytest.fixture(scope="session", autouse=True)
def block_unmocked_requests():
    """
    Prevents requests from being made unless they are mocked.

    Helps avoid inadvertent dependencies on external resources during the test run.
    """

    def mocked_send(*args, **kwargs):
        raise RuntimeError("Tests must mock all HTTP requests!")

    # The standard monkeypatch fixture cannot be used with session scope:
    # https://github.com/pytest-dev/pytest/issues/363
    monkeypatch = MonkeyPatch()
    # Monkeypatching here since any higher level would break responses:
    # https://github.com/getsentry/responses/blob/0.5.1/responses.py#L295
    monkeypatch.setattr("requests.adapters.HTTPAdapter.send", mocked_send)
    yield monkeypatch
    monkeypatch.undo()


@pytest.fixture
def sample_data():
    """Returns a SampleData() object"""
    from .sampledata import SampleData

    return SampleData()


@pytest.fixture(scope="session")
def test_base_dir():
    return os.path.dirname(__file__)


@pytest.fixture
def sample_push(sample_data):
    return copy.deepcopy(sample_data.push_data)


@pytest.fixture(name="create_push")
def fixture_create_push():
    """Return a function to create a push"""

    def create(
        repository,
        revision="4c45a777949168d16c03a4cba167678b7ab65f76",
        author="foo@bar.com",
        time=None,
        explicit_id=None,
    ):
        return th_models.Push.objects.create(
            id=explicit_id,
            repository=repository,
            revision=revision,
            author=author,
            time=time or datetime.datetime.now(),
        )

    return create


@pytest.fixture(name="create_commit")
def fixture_create_commit():
    """Return a function to create a commit"""

    def create(push, comments="Bug 12345 - This is a message"):
        return th_models.Commit.objects.create(
            push=push, revision=push.revision, author=push.author, comments=comments
        )

    return create


@pytest.fixture(name="create_signature")
def fixture_create_signature():
    """Returns a function to create a signature"""

    def create(
        signature_hash,
        extra_options,
        platform,
        measurement_unit,
        suite,
        test,
        test_perf_signature,
        repository,
        application="",
    ):
        return perf_models.PerformanceSignature.objects.create(
            repository=repository,
            signature_hash=signature_hash,
            framework=test_perf_signature.framework,
            platform=platform,
            option_collection=test_perf_signature.option_collection,
            suite=suite,
            test=test,
            has_subtests=test_perf_signature.has_subtests,
            extra_options=extra_options,
            last_updated=datetime.datetime.now(),
            measurement_unit=measurement_unit,
            application=application,
        )

    return create


@pytest.fixture(name="create_perf_datum")
def fixture_create_perf_datum():
    """Returns a function to create a performance datum"""

    def create(index, job, push, sig, sig_values):
        job.push = push
        job.save()
        perf_datum = perf_models.PerformanceDatum.objects.create(
            value=sig_values[index],
            push_timestamp=job.push.time,
            job=job,
            push=job.push,
            repository=job.repository,
            signature=sig,
        )
        perf_datum.push.time = job.push.time
        perf_datum.push.save()
        return perf_datum

    return create


@pytest.fixture
def test_repository(django_db_reset_sequences):
    th_models.RepositoryGroup.objects.get_or_create(name="development", description="")

    r = th_models.Repository.objects.create(
        dvcs_type="hg",
        name=settings.TREEHERDER_TEST_REPOSITORY_NAME,
        url="https://hg.mozilla.org/mozilla-central",
        active_status="active",
        codebase="gecko",
        repository_group_id=1,
        description="",
        performance_alerts_enabled=True,
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )
    return r


@pytest.fixture
def try_repository(transactional_db):
    repo_group, _ = th_models.RepositoryGroup.objects.get_or_create(
        name="development", description=""
    )

    r = th_models.Repository.objects.create(
        id=4,
        dvcs_type="hg",
        name="try",
        url="https://hg.mozilla.org/try",
        active_status="active",
        codebase="gecko",
        repository_group_id=repo_group.id,
        description="",
        is_try_repo=True,
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )
    return r


@pytest.fixture
def relevant_repository(transactional_db):
    repo_group, _ = th_models.RepositoryGroup.objects.get_or_create(
        name="development", description=""
    )

    r = th_models.Repository.objects.create(
        dvcs_type="hg",
        name="relevant_repository",
        url="https://hg.mozilla.org/try",
        active_status="active",
        codebase="gecko",
        repository_group_id=repo_group.id,
        description="",
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )
    return r


@pytest.fixture
def test_issue_tracker(transactional_db):
    return perf_models.IssueTracker.objects.create(
        name="Bugzilla", task_base_url="https://bugzilla.mozilla.org/show_bug.cgi?id="
    )


@pytest.fixture
def test_repository_2(test_repository):
    return th_models.Repository.objects.create(
        repository_group=test_repository.repository_group,
        name=test_repository.name + "_2",
        dvcs_type=test_repository.dvcs_type,
        url=test_repository.url + "_2",
        codebase=test_repository.codebase,
    )


@pytest.fixture
def test_push(create_push, test_repository):
    return create_push(test_repository)


@pytest.fixture
def test_perfcomp_push(create_push, test_repository):
    return create_push(test_repository, "1377267c6dc1")


@pytest.fixture
def test_perfcomp_push_2(create_push, test_repository):
    return create_push(test_repository, "08038e535f58")


@pytest.fixture
def test_linux_platform():
    return th_models.MachinePlatform.objects.create(
        os_name="-", platform="linux1804-64-shippable-qr", architecture="-"
    )


@pytest.fixture
def test_macosx_platform():
    return th_models.MachinePlatform.objects.create(
        os_name="", platform="macosx1015-64-shippable-qr", architecture=""
    )


@pytest.fixture
def test_option_collection():
    return perfcompare_utils.get_option_collection_map()


@pytest.fixture
def test_commit(create_commit, test_push):
    return create_commit(test_push)


@pytest.fixture(name="create_jobs")
def fixture_create_jobs(test_repository, failure_classifications):
    """Return a function to create jobs"""

    def create(jobs):
        store_job_data(test_repository, jobs)
        return [th_models.Job.objects.get(id=i) for i in range(1, len(jobs) + 1)]

    return create


@pytest.fixture
def test_job(hundred_job_blobs, create_jobs):
    job = hundred_job_blobs[0]
    job["job"].update(
        {"taskcluster_task_id": "V3SVuxO8TFy37En_6HcXLs", "taskcluster_retry_id": "0"}
    )
    return create_jobs([job])[0]


@pytest.fixture
def test_jobs(hundred_job_blobs_new_date, create_jobs):
    return create_jobs(hundred_job_blobs_new_date)


@pytest.fixture
def test_two_jobs_tc_metadata(hundred_job_blobs_new_date, create_jobs):
    job_1, job_2 = hundred_job_blobs_new_date[0:2]
    job_1["job"].update(
        {
            "status": "completed",
            "result": "testfailed",
            "taskcluster_task_id": "V3SVuxO8TFy37En_6HcXLs",
            "taskcluster_retry_id": "0",
        }
    )
    job_2["job"].update(
        {
            "status": "completed",
            "result": "testfailed",
            "taskcluster_task_id": "FJtjczXfTAGClIl6wNBo9g",
            "taskcluster_retry_id": "0",
        }
    )
    return create_jobs([job_1, job_2])


@pytest.fixture
def test_job_2(hundred_job_blobs, create_jobs):
    return create_jobs(hundred_job_blobs[0:2])[1]


@pytest.fixture
def test_job_3(hundred_job_blobs, create_jobs):
    return create_jobs(hundred_job_blobs[0:3])[2]


@pytest.fixture
def mock_log_parser(monkeypatch):
    from celery import shared_task

    from treeherder.log_parser import tasks

    @shared_task
    def task_mock(*args, **kwargs):
        pass

    monkeypatch.setattr(tasks, "parse_logs", task_mock)


@pytest.fixture
def taskcluster_notify_mock(monkeypatch):
    mock = MagicMock()

    def mockreturn(*arg, **kwargs):
        nonlocal mock
        return mock

    monkeypatch.setattr(taskcluster, "notify_client_factory", mockreturn)
    return mock


@pytest.fixture
def mock_tc_prod_backfill_credentials(monkeypatch):
    monkeypatch.setattr(settings, "PERF_SHERIFF_BOT_CLIENT_ID", "client_id")
    monkeypatch.setattr(settings, "PERF_SHERIFF_BOT_ACCESS_TOKEN", "access_token")


@pytest.fixture
def mock_tc_prod_notify_credentials(monkeypatch):
    monkeypatch.setattr(settings, "NOTIFY_CLIENT_ID", "client_id")
    monkeypatch.setattr(settings, "NOTIFY_ACCESS_TOKEN", "access_token")


@pytest.fixture
def push_stored(test_repository, sample_push):
    store_push_data(test_repository, sample_push)

    return sample_push


@pytest.fixture
def try_push_stored(try_repository, sample_push):
    store_push_data(try_repository, sample_push)

    return sample_push


@pytest.fixture
def hundred_job_blobs(sample_data, sample_push, test_repository, mock_log_parser):
    store_push_data(test_repository, sample_push)

    # NOTE: when generating new data, we appear to need more jobs to find similar jobs
    num_jobs = 100
    jobs = sample_data.job_data[0:num_jobs]

    max_index = len(sample_push) - 1
    push_index = 0
    task_id_index = 0

    blobs = []
    for blob in jobs:
        if push_index > max_index:
            push_index = 0

        # Modify job structure to sync with the push sample data
        if "sources" in blob:
            del blob["sources"]

        blob["revision"] = sample_push[push_index]["revision"]
        blob["job"]["taskcluster_task_id"] = f"V3SVuxO8TFy37En_6Hc{str(task_id_index).zfill(3)}"
        blob["job"]["taskcluster_retry_id"] = "0"
        blobs.append(blob)

        push_index += 1
        task_id_index += 1
    return blobs


@pytest.fixture
def hundred_job_blobs_new_date(sample_data, sample_push, test_repository, mock_log_parser):
    # make unique revisions
    counter = 0
    for push in sample_push:
        push["push_timestamp"] = int(time.time()) + counter
        counter += 1

    store_push_data(test_repository, sample_push)

    num_jobs = 11
    jobs = sample_data.job_data[0:num_jobs]

    max_index = len(sample_push) - 1
    push_index = 0
    task_id_index = 0

    blobs = []
    for blob in jobs:
        if push_index > max_index:
            push_index = 0

        # Modify job structure to sync with the push sample data
        if "sources" in blob:
            del blob["sources"]

        blob["revision"] = sample_push[push_index]["revision"]
        blob["job"]["taskcluster_task_id"] = f"V3SVuxO8TFy37En_6Hc{str(task_id_index).zfill(3)}"
        blob["job"]["taskcluster_retry_id"] = "0"
        blob["job"]["revision"] = sample_push[push_index]["revision"]
        blob["job"]["submit_timestamp"] = sample_push[push_index]["push_timestamp"]
        blob["job"]["start_timestamp"] = sample_push[push_index]["push_timestamp"] + 10
        blob["job"]["end_timestamp"] = sample_push[push_index]["push_timestamp"] + 1000
        blobs.append(blob)

        push_index += 1
        task_id_index += 1
    return blobs


@pytest.fixture
def eleven_jobs_stored_new_date(
    test_repository, failure_classifications, hundred_job_blobs_new_date
):
    """stores a list of 11 job samples"""
    store_job_data(test_repository, hundred_job_blobs_new_date)


@pytest.fixture
def eleven_jobs_stored(test_repository, failure_classifications, hundred_job_blobs):
    """stores a list of 11 job samples"""
    store_job_data(test_repository, hundred_job_blobs)


@pytest.fixture
def five_intermittent_jobs(test_repository, hundred_job_blobs, create_jobs):
    """make multiple failures for same platform/variant"""
    jobs = []
    for i in range(0, 5):
        # this allows every other task to repeat the job name
        if i % 2 == 0:
            name = hundred_job_blobs[i]["job"]["name"]

        job = hundred_job_blobs[i]
        job["job"].update({"name": name})
        jobs.append(job)
    return create_jobs(jobs)[0]


#    store_job_data(test_repository, hundred_job_blobs[0:5])


@pytest.fixture
def taskcluster_jobs_stored(test_repository, sample_data):
    """stores a list of TaskCluster job samples"""
    store_job_data(test_repository, sample_data.transformed_pulse_jobs)


@pytest.fixture
def test_job_with_notes(test_job, test_user):
    """test job with job notes."""

    for failure_classification_id in [2, 3]:
        th_models.JobNote.objects.create(
            job=test_job,
            failure_classification_id=failure_classification_id,
            user=test_user,
            text="you look like a man-o-lantern",
        )

    test_job.refresh_from_db()

    return test_job


@pytest.fixture
def activate_responses(request):
    responses.start()

    def fin():
        responses.reset()
        responses.stop()

    request.addfinalizer(fin)


@pytest.fixture
def pulse_connection():
    """
    Build a Pulse connection with the Kombu library

    This is a non-lazy mirror of our Pulse service's build_connection as
    explained in: https://bugzilla.mozilla.org/show_bug.cgi?id=1484196
    """
    return kombu.Connection(settings.CELERY_BROKER_URL)


@pytest.fixture
def pulse_exchange(pulse_connection, request):
    def build_exchange(name, create_exchange):
        return get_exchange(pulse_connection, name, create=create_exchange)

    return build_exchange


@pytest.fixture
def failure_lines(test_job):
    return create_failure_lines(test_job, [(test_line, {}), (test_line, {"subtest": "subtest2"})])


@pytest.fixture
def failure_line_logs(test_job):
    return create_failure_lines(
        test_job,
        [
            (test_line, {"action": "log", "test": None}),
            (test_line, {"subtest": "subtest2"}),
        ],
    )


@pytest.fixture
def failure_classifications(transactional_db):
    for name in [
        "not classified",
        "fixed by commit",
        "expected fail",
        "intermittent",
        "infra",
        "intermittent needs filing",
        "autoclassified intermittent",
    ]:
        th_models.FailureClassification(name=name).save()


@pytest.fixture
def text_log_errors_failure_lines(test_job, failure_lines):
    lines = [(test_line, {}), (test_line, {"subtest": "subtest2"})]

    text_log_errors = create_text_log_errors(test_job, lines)

    for error_line, failure_line in zip(text_log_errors, failure_lines):
        th_models.TextLogErrorMetadata.objects.create(
            text_log_error=error_line, failure_line=failure_line
        )

    return text_log_errors, failure_lines


@pytest.fixture
def test_matcher(request):
    return "TreeherderUnitTestDetector"


@pytest.fixture
def classified_failures(
    test_job, text_log_errors_failure_lines, test_matcher, failure_classifications
):
    _, failure_lines = text_log_errors_failure_lines

    classified_failures = []

    for failure_line in failure_lines:
        if failure_line.job_guid == test_job.guid:
            classified_failure = th_models.ClassifiedFailure.objects.create()

            failure_line.error.create_match(test_matcher, classified_failure)

            classified_failures.append(classified_failure)

    return classified_failures


@pytest.fixture
def test_user(db):
    # a user *without* sheriff/staff permissions
    user = th_models.User.objects.create(username="testuser1", email="user@foo.com", is_staff=False)
    return user


@pytest.fixture
def test_ldap_user(db):
    """
    A user whose username matches those generated for LDAP SSO logins,
    and who does not have `is_staff` permissions.
    """
    user = th_models.User.objects.create(
        username="mozilla-ldap/user@foo.com", email="user@foo.com", is_staff=False
    )
    return user


@pytest.fixture
def test_sheriff(db):
    # a user *with* sheriff/staff permissions
    user = th_models.User.objects.create(
        username="testsheriff1", email="sheriff@foo.com", is_staff=True
    )
    return user


@pytest.fixture
def test_perf_framework(transactional_db):
    return perf_models.PerformanceFramework.objects.create(name="test_talos", enabled=True)


@pytest.fixture
def test_perf_signature(test_repository, test_perf_framework) -> perf_models.PerformanceSignature:
    windows_7_platform = th_models.MachinePlatform.objects.create(
        os_name="win", platform="win7", architecture="x86"
    )
    return create_perf_signature(test_perf_framework, test_repository, windows_7_platform)


def create_perf_signature(
    perf_framework, repository, machine_platform: th_models.MachinePlatform
) -> perf_models.PerformanceSignature:
    option = th_models.Option.objects.create(name="opt")
    option_collection = th_models.OptionCollection.objects.create(
        option_collection_hash="my_option_hash", option=option
    )

    return perf_models.PerformanceSignature.objects.create(
        repository=repository,
        signature_hash=(40 * "t"),
        framework=perf_framework,
        platform=machine_platform,
        option_collection=option_collection,
        suite="mysuite",
        test="mytest",
        application="firefox",
        has_subtests=False,
        tags="warm pageload",
        extra_options="e10s opt",
        measurement_unit="ms",
        last_updated=datetime.datetime.now(),
    )


@pytest.fixture
def test_taskcluster_metadata(test_job_2) -> th_models.TaskclusterMetadata:
    return create_taskcluster_metadata(test_job_2)


@pytest.fixture
def test_taskcluster_metadata_2(test_job_3) -> th_models.TaskclusterMetadata:
    return create_taskcluster_metadata_2(test_job_3)


def create_taskcluster_metadata(test_job_2) -> th_models.TaskclusterMetadata:
    return th_models.TaskclusterMetadata.objects.create(
        job=test_job_2,
        task_id="V3SVuxO8TFy37En_6HcXLp",
        retry_id="0",
    )


def create_taskcluster_metadata_2(test_job_3) -> th_models.TaskclusterMetadata:
    return th_models.TaskclusterMetadata.objects.create(
        job=test_job_3,
        task_id="V3SVuxO8TFy37En_6HcXLq",
        retry_id="0",
    )


@pytest.fixture
def test_perf_signature_2(test_perf_signature):
    return perf_models.PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=(20 * "t2"),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite="mysuite2",
        test="mytest2",
        has_subtests=test_perf_signature.has_subtests,
        extra_options=test_perf_signature.extra_options,
        last_updated=datetime.datetime.now(),
    )


@pytest.fixture
def test_stalled_data_signature(test_perf_signature):
    stalled_data_timestamp = datetime.datetime.now() - datetime.timedelta(days=120)
    return perf_models.PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=(20 * "t3"),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite="mysuite3",
        test="mytest3",
        has_subtests=test_perf_signature.has_subtests,
        extra_options=test_perf_signature.extra_options,
        last_updated=stalled_data_timestamp,
    )


@pytest.fixture
def test_perf_data(test_perf_signature, eleven_jobs_stored):
    # for making things easier, ids for jobs
    # and push should be the same;
    # also, we only need a subset of jobs
    perf_jobs = th_models.Job.objects.filter(pk__in=range(7, 11)).order_by("id").all()

    for index, job in enumerate(perf_jobs, start=1):
        job.push_id = index
        job.save()

        perf_datum = perf_models.PerformanceDatum.objects.create(
            value=10,
            push_timestamp=job.push.time - datetime.timedelta(days=100),
            job=job,
            push=job.push,
            repository=job.repository,
            signature=test_perf_signature,
        )
        perf_datum.push.time = job.push.time
        perf_datum.push.save()

    return perf_models.PerformanceDatum.objects.order_by("id").all()


@pytest.fixture
def mock_bugzilla_api_request(monkeypatch):
    """Mock fetch_json() used by Bugzilla ETL to return a local sample file."""

    def _fetch_json(url, params=None):
        tests_folder = os.path.dirname(__file__)
        bug_list_path = os.path.join(tests_folder, "sample_data", "bug_list.json")
        with open(bug_list_path) as f:
            last_change_time = (datetime.datetime.utcnow() - datetime.timedelta(days=30)).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
            data = json.load(f)
            for bug in data["bugs"]:
                bug["last_change_time"] = last_change_time
            return data

    monkeypatch.setattr(treeherder.etl.bugzilla, "fetch_json", _fetch_json)


@pytest.fixture
def mock_deviance(monkeypatch):
    """
    This mock should only be used when
    dealing with a time-series of constant values.
    """

    def _deviance(*args, **kwargs):
        return "OK", 0

    monkeypatch.setattr(moz_measure_noise, "deviance", _deviance)


@pytest.fixture
def bugs(mock_bugzilla_api_request):
    from treeherder.etl.bugzilla import BzApiBugProcess

    process = BzApiBugProcess()
    process.run()

    return th_models.Bugscache.objects.filter(bugzilla_id__isnull=False).order_by("bugzilla_id")


@pytest.fixture
def mock_bugzilla_reopen_request(monkeypatch, request):
    """Mock reopen_request() used to reopen incomplete bugs."""

    def _reopen_request(url, method, headers, json):
        import json as json_module

        reopened_bugs = request.config.cache.get("reopened_bugs", {})
        reopened_bugs[url] = json_module.dumps(json)
        request.config.cache.set("reopened_bugs", reopened_bugs)

    monkeypatch.setattr(treeherder.etl.bugzilla, "reopen_request", _reopen_request)


@pytest.fixture
def client():
    """
    A django-rest-framework APIClient instance:
    http://www.django-rest-framework.org/api-guide/testing/#apiclient
    """
    return APIClient()


@pytest.fixture
def authorized_sheriff_client(client, test_sheriff):
    client.force_authenticate(user=test_sheriff)
    return client


@pytest.fixture
def mock_file_bugzilla_map_request(monkeypatch):
    """
    Mock fetch_json() used by files_bugzilla_map ETL to return local sample
    files which map source files to Bugzilla components.
    """
    import treeherder.etl.files_bugzilla_map

    def _fetch_data(self, project):
        url = f"https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2.{project}.latest.source.source-bugzilla-info/artifacts/public/components.json"
        files_bugzilla_data = None
        file_name = f"files_bugzilla_map_{project}_{self.run_id}.json"
        exception = None
        try:
            tests_folder = os.path.dirname(__file__)
            data_path = os.path.join(tests_folder, "sample_data", "files_bugzilla_map", file_name)
            with open(data_path) as f:
                files_bugzilla_data = json.load(f)
        except Exception as e:
            exception = e
        return {
            "url": url,
            "files_bugzilla_data": files_bugzilla_data,
            "exception": exception,
        }

    monkeypatch.setattr(
        treeherder.etl.files_bugzilla_map.FilesBugzillaMapProcess,
        "fetch_data",
        _fetch_data,
    )


@pytest.fixture
def mock_bugscache_bugzilla_request(monkeypatch):
    """
    Mock fetch_intermittent_bugs() used by bugzilla ETL to return local Bugzilla
    sample data.
    """

    def _fetch_intermittent_bugs(additional_params, limit, duplicate_chain_length):
        tests_folder = os.path.dirname(__file__)
        file_name = f"run-{str(duplicate_chain_length)}.json"
        data_path = os.path.join(tests_folder, "sample_data", "bugscache_population", file_name)
        with open(data_path) as f:
            bugzilla_data = json.load(f)
            for bug in bugzilla_data["bugs"]:
                bug["last_change_time"] = (
                    datetime.datetime.now() - datetime.timedelta(20)
                ).isoformat(timespec="seconds") + "Z"
        return bugzilla_data["bugs"]

    monkeypatch.setattr(
        treeherder.etl.bugzilla, "fetch_intermittent_bugs", _fetch_intermittent_bugs
    )


@pytest.fixture
def mock_test_variants_firefoxci_request(monkeypatch):
    """
    Mock fetch_test_variants() used to retreive test variants from firefox-ci
    """

    def _fetch_test_variants():
        tests_folder = os.path.dirname(__file__)
        file_name = "variants.yml"
        data_path = os.path.join(tests_folder, "sample_data", file_name)
        with open(data_path) as f:
            data = yaml.safe_load(f)
        return data

    monkeypatch.setattr(
        treeherder.intermittents_commenter.commenter.fetch,
        "fetch_test_variants",
        _fetch_test_variants,
    )


@pytest.fixture
def mock_test_manifests_firefoxci_request(monkeypatch):
    """
    Mock fetch_test_manifests() used to retreive test manifests from firefox-ci
    """

    def _fetch_test_manifests():
        tests_folder = os.path.dirname(__file__)
        file_name = "test-info-all-tests.json"
        data_path = os.path.join(tests_folder, "sample_data", file_name)
        with open(data_path) as f:
            data = json.load(f)
        return data

    monkeypatch.setattr(
        treeherder.intermittents_commenter.commenter.fetch,
        "fetch_test_manifests",
        _fetch_test_manifests,
    )


@pytest.fixture
def mock_testrun_matrix_firefoxci_request(monkeypatch):
    """
    Mock fetch_testrun_matrix() used to retreive testrun matrix from firefox-ci
    """

    def _fetch_testrun_matrix():
        tests_folder = os.path.dirname(__file__)
        file_name = "test-info-testrun-matrix.json"
        data_path = os.path.join(tests_folder, "sample_data", file_name)
        with open(data_path) as f:
            data = json.load(f)
        return data

    monkeypatch.setattr(
        treeherder.intermittents_commenter.commenter.fetch,
        "fetch_testrun_matrix",
        _fetch_testrun_matrix,
    )


@pytest.fixture
def mock_summary_groups_request(monkeypatch):
    """
    Mock get_summary_groups()
    """

    def _fetch_summary_groups(days):
        tests_folder = os.path.dirname(__file__)
        file_name = "summary_groups.json"
        data_path = os.path.join(tests_folder, "sample_data", file_name)
        with open(data_path) as f:
            data = json.load(f)
        return data

    monkeypatch.setattr(
        treeherder.intermittents_commenter.commenter.fetch,
        "fetch_summary_groups",
        _fetch_summary_groups,
    )


class MockResponse:
    def __init__(self):
        self.status_code = 200
        self.content = {
            "artifacts": [
                {
                    "storageType": "fake",
                    "name": "fake/path.json",
                    "expires": "2999-12-31T23:59:59.999Z",
                    "contentType": "application/octet-stream",
                }
            ]
        }


@pytest.fixture
def mock_get_artifact_list(monkeypatch):
    import treeherder.webapp.api.utils

    def _mock_get(url, params=None):
        return MockResponse()

    monkeypatch.setattr(treeherder.webapp.api.utils, "fetch_json", _mock_get)


@pytest.fixture
def mock_cache(monkeypatch):
    import django.core.cache.cache

    def mockreturn_cache(*args, **kwargs):
        return {"task_id": "some_id", "retry_id": 0}

    monkeypatch.setattr(django.core.cache.cache, "get", mockreturn_cache)


@pytest.fixture
def text_log_error_lines(test_job, failure_lines):
    lines = [
        (item, {}) for item in th_models.FailureLine.objects.filter(job_guid=test_job.guid).values()
    ]

    errors = create_text_log_errors(test_job, lines)

    return errors


@pytest.fixture
def test_perf_tag():
    return perf_models.PerformanceTag.objects.create(name="first_tag")


@pytest.fixture
def test_perf_tag_2():
    return perf_models.PerformanceTag.objects.create(name="second_tag")


@pytest.fixture
def test_perf_alert_summary(test_repository, push_stored, test_perf_framework, test_issue_tracker):
    test_perf_tag = perf_models.PerformanceTag.objects.create(name="harness")

    performance_alert_summary = perf_models.PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now(),
    )
    performance_alert_summary.performance_tags.add(test_perf_tag)

    return performance_alert_summary


@pytest.fixture
def test_perf_alert_summary_2(test_perf_alert_summary):
    return perf_models.PerformanceAlertSummary.objects.create(
        repository=test_perf_alert_summary.repository,
        framework=test_perf_alert_summary.framework,
        prev_push_id=test_perf_alert_summary.prev_push_id + 1,
        push_id=test_perf_alert_summary.push_id + 1,
        manually_created=False,
        created=datetime.datetime.now(),
    )


@pytest.fixture
def test_perf_alert_summary_with_bug(
    test_repository, push_stored, test_perf_framework, test_issue_tracker
):
    return perf_models.PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now(),
        bug_number=123456,
        bug_updated=datetime.datetime.now(),
    )


@pytest.fixture
def test_perf_datum(test_repository, test_perf_signature, test_job_2):
    push = th_models.Push.objects.get(id=1)
    perf_models.PerformanceDatum.objects.create(
        repository=test_repository,
        job=test_job_2,
        push_id=1,
        signature=test_perf_signature,
        value=1,
        push_timestamp=push.time,
    )


@pytest.fixture
def test_perf_datum_2(test_repository, test_perf_signature, test_job_3):
    push = th_models.Push.objects.get(id=2)
    perf_models.PerformanceDatum.objects.create(
        repository=test_repository,
        job=test_job_3,
        push_id=2,
        signature=test_perf_signature,
        value=1,
        push_timestamp=push.time,
    )


@pytest.fixture
def test_perf_alert(test_perf_signature, test_perf_alert_summary) -> perf_models.PerformanceAlert:
    return create_perf_alert(summary=test_perf_alert_summary, series_signature=test_perf_signature)


@pytest.fixture
def test_perf_alert_with_tcmetadata(
    test_perf_signature, test_perf_alert_summary
) -> perf_models.PerformanceAlert:
    perf_alert = create_perf_alert(
        summary=test_perf_alert_summary, series_signature=test_perf_signature
    )
    perf_alert.taskcluster_metadata = test_taskcluster_metadata_2
    perf_alert.prev_taskcluster_metadata = test_taskcluster_metadata
    perf_alert.save()
    return perf_alert


def create_perf_alert(**alert_properties) -> perf_models.PerformanceAlert:
    defaults = dict(
        amount_abs=50.0,
        amount_pct=0.5,
        is_regression=True,
        new_value=150.0,
        prev_value=100.0,
        t_value=20.0,
    )
    alert_properties = {**defaults, **alert_properties}
    return perf_models.PerformanceAlert.objects.create(**alert_properties)


@pytest.fixture
def test_conflicting_perf_alert(
    test_perf_signature, test_perf_alert_summary_2
) -> perf_models.PerformanceAlert:
    return create_perf_alert(
        summary=test_perf_alert_summary_2, series_signature=test_perf_signature
    )


@pytest.fixture
def test_perf_alert_2(
    test_perf_alert, test_perf_signature_2, test_perf_alert_summary_2
) -> perf_models.PerformanceAlert:
    return create_perf_alert(
        summary=test_perf_alert_summary_2, series_signature=test_perf_signature_2
    )


@pytest.fixture
def generic_reference_data(test_repository):
    """
    Generic reference data (if you want to create a bunch of mock jobs)
    """

    class RefdataHolder:
        pass

    r = RefdataHolder()

    r.option = th_models.Option.objects.create(name="my_option")
    r.option_collection = th_models.OptionCollection.objects.create(
        option_collection_hash="my_option_hash", option=r.option
    )
    r.option_collection_hash = r.option_collection.option_collection_hash
    r.machine_platform = th_models.MachinePlatform.objects.create(
        os_name="my_os", platform="my_platform", architecture="x86"
    )
    r.build_platform = th_models.BuildPlatform.objects.create(
        os_name="my_os", platform="my_platform", architecture="x86"
    )
    r.machine = th_models.Machine.objects.create(name="mymachine")
    r.job_group = th_models.JobGroup.objects.create(symbol="S", name="myjobgroup")
    r.job_type = th_models.JobType.objects.create(symbol="j", name="myjob")
    r.product = th_models.Product.objects.create(name="myproduct")
    r.signature = th_models.ReferenceDataSignatures.objects.create(
        name="myreferencedatasignaeture",
        signature="1234",
        build_os_name=r.build_platform.os_name,
        build_platform=r.build_platform.platform,
        build_architecture=r.build_platform.architecture,
        machine_os_name=r.machine_platform.os_name,
        machine_platform=r.machine_platform.platform,
        machine_architecture=r.machine_platform.architecture,
        job_group_name=r.job_group.name,
        job_group_symbol=r.job_group.symbol,
        job_type_name=r.job_type.name,
        job_type_symbol=r.job_type.symbol,
        option_collection_hash=r.option_collection_hash,
        build_system_type="buildbot",
        repository=test_repository.name,
        first_submission_timestamp=0,
    )

    return r


@pytest.fixture
def bug_data(eleven_jobs_stored, test_repository, test_push, bugs):
    jobs = th_models.Job.objects.all().order_by("id")
    bug_id = bugs[0].bugzilla_id
    job_id = jobs[0].id
    th_models.BugJobMap.create(job_id=job_id, bugzilla_id=bug_id)
    query_string = f"?startday=2025-02-26&endday=2025-03-03&tree={test_repository.name}"

    return {
        "tree": test_repository.name,
        "option": th_models.Option.objects.first(),
        "bug_id": bug_id,
        "job": jobs[0],
        "jobs": jobs,
        "query_string": query_string,
        "task_id": "V3SVuxO8TFy37En_6Hc000",
    }


@pytest.fixture
def bug_data_with_5_failures(five_intermittent_jobs, test_repository, test_push, bugs):
    jobs = th_models.Job.objects.all().order_by("id")
    bug_id = bugs[0].bugzilla_id
    for index, job in enumerate(jobs[:5]):
        th_models.BugJobMap.create(job_id=job.id, bugzilla_id=bug_id)

    return {
        "bug_id": bug_id,
    }


@pytest.fixture
def test_run_data(bug_data):
    pushes = list(th_models.Push.objects.all())
    time = sorted(
        [
            p.time.strftime("%Y-%m-%d")
            for p in pushes
            if p.time.strftime("%Y-%m-%d")
            >= bug_data["query_string"].split("startday=")[1].split("&")[0]
        ]
    )[0]
    test_runs = 0
    for push in pushes:
        if push.time.strftime("%Y-%m-%d") == time:
            test_runs += 1

    return {"test_runs": test_runs, "push_time": time}


@pytest.fixture
def group_data(transactional_db, hundred_job_blobs, create_jobs):
    query_string = "?manifest=/test&date=2025-02-28"

    jt = []
    jt.append(th_models.JobType.objects.create(name="test-windows11-64-24h2/opt-mochitest-plain-1"))
    jt.append(th_models.JobType.objects.create(name="test-windows11-64-24h2/opt-mochitest-plain-2"))
    jt.append(
        th_models.JobType.objects.create(name="test-windows11-64-24h2/opt-mochitest-plain-swr-1")
    )

    g1 = th_models.Group.objects.create(name="/test")
    for i in range(3):
        job = hundred_job_blobs[i]
        job["job"].update(
            {
                "taskcluster_task_id": f"V3SVuxO8TFy37En_6Hc{str(i).zfill(3)}",
                "taskcluster_retry_id": "0",
                "name": jt[i].name,
            }
        )
        j = create_jobs([job])[0]

        # when creating the job, we also create the joblog, we want the last entry
        job_log = th_models.JobLog.objects.last()

        th_models.GroupStatus.objects.create(status=1, duration=1, job_log=job_log, group=g1)

    query_string = "?manifest=/test&startdate=2025-02-28"
    return {
        "date": j.submit_time,
        "manifest": "/test",
        "query_string": query_string,
        "expected": {
            "job_type_names": [
                "test-windows11-64-24h2/opt-mochitest-plain",
            ],
            "manifests": [
                {
                    "/test": [[0, "passed", 1, 1]],
                }
            ],
        },
    }


@pytest.fixture
def generate_enough_perf_datum(test_repository, test_perf_signature):
    # generate enough data for a proper alert to be generated (with enough
    # extra data on both sides to make sure we're using the proper values
    # to generate the actual alert)

    for push_id, value in zip([1] * 30 + [2] * 30, [1] * 30 + [2] * 30):
        push = th_models.Push.objects.get(id=push_id)
        perf_models.PerformanceDatum.objects.create(
            repository=test_repository,
            push_id=push_id,
            signature=test_perf_signature,
            value=value,
            push_timestamp=push.time,
        )


@pytest.fixture
def sample_option_collections(transactional_db):
    option1 = th_models.Option.objects.create(name="opt1")
    option2 = th_models.Option.objects.create(name="opt2")
    th_models.OptionCollection.objects.create(option_collection_hash="option_hash1", option=option1)
    th_models.OptionCollection.objects.create(option_collection_hash="option_hash2", option=option2)


@pytest.fixture
def backfill_record_context():
    return {
        "data_points_to_retrigger": [
            {
                "perf_datum_id": 933219901,
                "value": 0.8714208119774209,
                "job_id": 269034923,
                "push_id": 565159,
                "push_timestamp": "2019-10-02 02:22:28",
                "push__revision": "04e8766a29242d4deae31b5b04e6ac61ebf61ffd",
            },
            {
                "perf_datum_id": 933219962,
                "value": 0.9160434865973892,
                "job_id": 269034920,
                "push_id": 565160,
                "push_timestamp": "2019-10-02 02:23:29",
                "push__revision": "9b42bdc4889fe7782df9b2a0aa990ed5e62cb04c",
            },
            {
                "perf_datum_id": 931772364,
                "value": 0.9508247997807697,
                "job_id": 268828343,
                "push_id": 565161,
                "push_timestamp": "2019-10-02 02:24:35",
                "push__revision": "057b59fdadad75e888a739e85a683b2ff7bfc62e",
            },
            {
                "perf_datum_id": 931924904,
                "value": 0.9829230628232519,
                "job_id": 268840223,
                "push_id": 565188,
                "push_timestamp": "2019-10-02 04:03:09",
                "push__revision": "49ef9afb62bb909389b105a1751e9b46e6f1688d",
            },
            {
                "perf_datum_id": 931927300,
                "value": 0.9873498499464002,
                "job_id": 268840309,
                "push_id": 565193,
                "push_timestamp": "2019-10-02 04:08:06",
                "push__revision": "f5cce52461bac31945b083e51a085fb429a36f04",
            },
        ]
    }


class JSONFixtureLoader:
    def __init__(self, *prior_dirs):
        self._prior_dirs = prior_dirs

    def __call__(self, fixture_filename):
        fixture_path = join(*self._prior_dirs, fixture_filename)
        with open(fixture_path) as f:
            return json.load(f)


class SampleDataJSONLoader:
    def __init__(self, *sub_dirs):
        global SAMPLE_DATA_PATH

        self.load_json = JSONFixtureLoader(SAMPLE_DATA_PATH, *sub_dirs)

    def __call__(self, fixture_filename):
        return self.load_json(fixture_filename)
