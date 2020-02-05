import copy
import datetime
import json
import os
import platform

import kombu
import pytest
import responses
from _pytest.monkeypatch import MonkeyPatch
from django.conf import settings
from rest_framework.test import APIClient

from treeherder.autoclassify.autoclassify import mark_best_classification
from treeherder.etl.jobs import store_job_data
from treeherder.etl.push import store_push_data
from treeherder.model.models import (Commit,
                                     JobNote,
                                     Option,
                                     OptionCollection,
                                     Push,
                                     TextLogErrorMetadata,
                                     User)
from treeherder.perf.models import (IssueTracker,
                                    PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)
from treeherder.services.pulse.exchange import get_exchange

IS_WINDOWS = "windows" in platform.system().lower()


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

    if 'slow' in item.keywords and not item.config.getoption("--runslow"):
        pytest.skip("need --runslow option to run")

    from django.core.cache import cache
    cache.clear()


@pytest.fixture(scope="session", autouse=True)
def block_unmocked_requests():
    """
    Prevents requests from being made unless they are mocked.

    Helps avoid inadvertent dependencies on external resources during the test run.
    """
    def mocked_send(*args, **kwargs):
        raise RuntimeError('Tests must mock all HTTP requests!')

    # The standard monkeypatch fixture cannot be used with session scope:
    # https://github.com/pytest-dev/pytest/issues/363
    monkeypatch = MonkeyPatch()
    # Monkeypatching here since any higher level would break responses:
    # https://github.com/getsentry/responses/blob/0.5.1/responses.py#L295
    monkeypatch.setattr('requests.adapters.HTTPAdapter.send', mocked_send)
    yield monkeypatch
    monkeypatch.undo()


@pytest.fixture
def sample_data():
    """Returns a SampleData() object"""
    from .sampledata import SampleData
    return SampleData()


@pytest.fixture(scope='session')
def test_base_dir():
    return os.path.dirname(__file__)


@pytest.fixture
def sample_push(sample_data):
    return copy.deepcopy(sample_data.push_data)


@pytest.fixture(name='create_push')
def fixture_create_push():
    """Return a function to create a push"""
    def create(repository,
               revision='4c45a777949168d16c03a4cba167678b7ab65f76',
               author='foo@bar.com'):
        return Push.objects.create(
            repository=repository,
            revision=revision,
            author=author,
            time=datetime.datetime.now())
    return create


@pytest.fixture(name='create_commit')
def fixture_create_commit():
    """Return a function to create a commit"""
    def create(push, comments='Bug 12345 - This is a message'):
        return Commit.objects.create(
            push=push,
            revision=push.revision,
            author=push.author,
            comments=comments)
    return create


@pytest.fixture
def test_repository(transactional_db):
    from treeherder.model.models import Repository, RepositoryGroup

    RepositoryGroup.objects.create(
        name="development",
        description=""
    )

    r = Repository.objects.create(
        dvcs_type="hg",
        name=settings.TREEHERDER_TEST_REPOSITORY_NAME,
        url="https://hg.mozilla.org/mozilla-central",
        active_status="active",
        codebase="gecko",
        repository_group_id=1,
        description="",
        performance_alerts_enabled=True,
        tc_root_url="https://tc.example.com",
    )
    return r


@pytest.fixture
def test_issue_tracker(transactional_db):
    return IssueTracker.objects.create(
        name="Bugzilla",
        task_base_url="https://bugzilla.mozilla.org/show_bug.cgi?id="
    )


@pytest.fixture
def test_repository_2(test_repository):
    from treeherder.model.models import Repository

    return Repository.objects.create(
        repository_group=test_repository.repository_group,
        name=test_repository.name + '_2',
        dvcs_type=test_repository.dvcs_type,
        url=test_repository.url + '_2',
        codebase=test_repository.codebase)


@pytest.fixture
def test_push(create_push, test_repository):
    return create_push(test_repository)


@pytest.fixture
def test_commit(create_commit, test_push):
    return create_commit(test_push)


@pytest.fixture(name='create_jobs')
def fixture_create_jobs(test_repository, failure_classifications):
    """Return a function to create jobs"""
    from treeherder.model.models import Job

    def create(jobs):
        store_job_data(test_repository, jobs)
        return [Job.objects.get(id=i) for i in range(1, len(jobs) + 1)]
    return create


@pytest.fixture
def test_job(eleven_job_blobs, create_jobs):
    return create_jobs(eleven_job_blobs[0:1])[0]


@pytest.fixture
def test_job_2(eleven_job_blobs, create_jobs):
    return create_jobs(eleven_job_blobs[0:2])[1]


@pytest.fixture
def mock_log_parser(monkeypatch):
    from celery import task
    from treeherder.log_parser import tasks

    @task
    def task_mock(*args, **kwargs):
        pass

    monkeypatch.setattr(tasks, 'parse_logs', task_mock)


@pytest.fixture
def push_stored(test_repository, sample_push):
    store_push_data(test_repository, sample_push)

    return sample_push


@pytest.fixture
def eleven_job_blobs(sample_data, sample_push, test_repository, mock_log_parser):
    store_push_data(test_repository, sample_push)

    num_jobs = 11
    jobs = sample_data.job_data[0:num_jobs]

    max_index = len(sample_push) - 1
    push_index = 0

    blobs = []
    for blob in jobs:

        if push_index > max_index:
            push_index = 0

        # Modify job structure to sync with the push sample data
        if 'sources' in blob:
            del blob['sources']

        blob['revision'] = sample_push[push_index]['revision']

        blobs.append(blob)

        push_index += 1
    return blobs


@pytest.fixture
def eleven_jobs_stored(test_repository, failure_classifications, eleven_job_blobs):
    """stores a list of 11 job samples"""
    store_job_data(test_repository, eleven_job_blobs)


@pytest.fixture
def taskcluster_jobs_stored(test_repository, sample_data):
    """stores a list of TaskCluster job samples"""
    store_job_data(test_repository, sample_data.transformed_pulse_jobs)


@pytest.fixture
def test_job_with_notes(test_job, test_user):
    """test job with job notes."""

    for failure_classification_id in [2, 3]:
        JobNote.objects.create(job=test_job,
                               failure_classification_id=failure_classification_id,
                               user=test_user,
                               text="you look like a man-o-lantern")

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
    from tests.autoclassify.utils import test_line, create_failure_lines

    return create_failure_lines(test_job,
                                [(test_line, {}),
                                 (test_line, {"subtest": "subtest2"})])


@pytest.fixture
def failure_line_logs(test_job):
    from tests.autoclassify.utils import test_line, create_failure_lines

    return create_failure_lines(test_job,
                                [(test_line, {'action': 'log', 'test': None}),
                                 (test_line, {'subtest': 'subtest2'})])


@pytest.fixture
def failure_classifications(transactional_db):
    from treeherder.model.models import FailureClassification
    for name in ["not classified", "fixed by commit", "expected fail",
                 "intermittent", "infra", "intermittent needs filing",
                 "autoclassified intermittent"]:
        FailureClassification(name=name).save()


@pytest.fixture
def text_log_errors_failure_lines(test_job, failure_lines):
    from tests.autoclassify.utils import test_line, create_text_log_errors

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"})]

    text_log_errors = create_text_log_errors(test_job, lines)

    for error_line, failure_line in zip(text_log_errors, failure_lines):
        TextLogErrorMetadata.objects.create(text_log_error=error_line,
                                            failure_line=failure_line)

    return text_log_errors, failure_lines


@pytest.fixture
def test_matcher(request):
    return "TreeherderUnitTestDetector"


@pytest.fixture
def classified_failures(test_job, text_log_errors_failure_lines, test_matcher,
                        failure_classifications):
    from treeherder.model.models import ClassifiedFailure

    _, failure_lines = text_log_errors_failure_lines

    classified_failures = []

    for failure_line in failure_lines:
        if failure_line.job_guid == test_job.guid:
            classified_failure = ClassifiedFailure.objects.create()

            failure_line.error.create_match(test_matcher, classified_failure)
            mark_best_classification(failure_line.error, classified_failure)

            classified_failures.append(classified_failure)

    return classified_failures


@pytest.fixture
def test_user(db):
    # a user *without* sheriff/staff permissions
    user = User.objects.create(username="testuser1",
                               email='user@foo.com',
                               is_staff=False)
    return user


@pytest.fixture
def test_ldap_user(db):
    """
    A user whose username matches those generated for LDAP SSO logins,
    and who does not have `is_staff` permissions.
    """
    user = User.objects.create(username="mozilla-ldap/user@foo.com",
                               email='user@foo.com',
                               is_staff=False)
    return user


@pytest.fixture
def test_sheriff(db):
    # a user *with* sheriff/staff permissions
    user = User.objects.create(username="testsheriff1",
                               email='sheriff@foo.com',
                               is_staff=True)
    return user


@pytest.fixture
def test_perf_framework(transactional_db):
    return PerformanceFramework.objects.create(
        name='test_talos', enabled=True)


@pytest.fixture
def test_perf_signature(test_repository, test_perf_framework):
    from treeherder.model.models import (MachinePlatform,
                                         Option,
                                         OptionCollection)

    option = Option.objects.create(name='opt')
    option_collection = OptionCollection.objects.create(
        option_collection_hash='my_option_hash',
        option=option)
    platform = MachinePlatform.objects.create(
        os_name='win',
        platform='win7',
        architecture='x86')

    signature = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40*'t'),
        framework=test_perf_framework,
        platform=platform,
        option_collection=option_collection,
        suite='mysuite',
        test='mytest',
        application='firefox',
        has_subtests=False,
        tags='warm pageload',
        extra_options='e10s opt',
        measurement_unit='ms',
        last_updated=datetime.datetime.now()
    )
    return signature


@pytest.fixture
def test_perf_signature_2(test_perf_signature):
    return PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=(20*'t2'),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite='mysuite2',
        test='mytest2',
        has_subtests=test_perf_signature.has_subtests,
        extra_options=test_perf_signature.extra_options,
        last_updated=datetime.datetime.now()
    )


@pytest.fixture
def test_perf_data(test_perf_signature, eleven_jobs_stored):
    from treeherder.model.models import Job

    # for making things easier, ids for jobs
    # and push should be the same;
    # also, we only need a subset of jobs
    perf_jobs = Job.objects.filter(pk__in=range(7, 11)).order_by('push__time').all()

    for index, job in enumerate(perf_jobs, start=1):
        job.push_id = index
        job.save()

        perf_datum = PerformanceDatum.objects.create(
            value=10,
            push_timestamp=job.push.time,
            job=job,
            push=job.push,
            repository=job.repository,
            signature=test_perf_signature
        )
        perf_datum.push.time = job.push.time
        perf_datum.push.save()

    return PerformanceDatum.objects.order_by('id').all()


@pytest.fixture
def mock_autoclassify_jobs_true(monkeypatch):
    monkeypatch.setattr(settings, 'AUTOCLASSIFY_JOBS', True)


@pytest.fixture
def mock_bugzilla_api_request(monkeypatch):
    """Mock fetch_json() used by Bugzilla ETL to return a local sample file."""
    import treeherder.etl.bugzilla

    def _fetch_json(url, params=None):
        tests_folder = os.path.dirname(__file__)
        bug_list_path = os.path.join(
            tests_folder,
            "sample_data",
            "bug_list.json"
        )
        with open(bug_list_path) as f:
            return json.load(f)

    monkeypatch.setattr(treeherder.etl.bugzilla,
                        'fetch_json',
                        _fetch_json)


@pytest.fixture
def bugs(mock_bugzilla_api_request):
    from treeherder.etl.bugzilla import BzApiBugProcess
    from treeherder.model.models import Bugscache

    process = BzApiBugProcess()
    process.run()

    return Bugscache.objects.all()


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
def text_log_error_lines(test_job, failure_lines):
    from tests.autoclassify.utils import create_text_log_errors
    from treeherder.model.models import FailureLine

    lines = [(item, {}) for item in FailureLine.objects.filter(job_guid=test_job.guid).values()]

    errors = create_text_log_errors(test_job, lines)

    return errors


@pytest.fixture
def test_perf_alert_summary(test_repository, push_stored, test_perf_framework, test_issue_tracker):
    return PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now())


@pytest.fixture
def test_perf_alert_summary_2(test_perf_alert_summary):
    return PerformanceAlertSummary.objects.create(
        repository=test_perf_alert_summary.repository,
        framework=test_perf_alert_summary.framework,
        prev_push_id=test_perf_alert_summary.prev_push_id+1,
        push_id=test_perf_alert_summary.push_id+1,
        manually_created=False,
        created=datetime.datetime.now())


@pytest.fixture
def test_perf_alert_summary_with_bug(test_repository, push_stored, test_perf_framework, test_issue_tracker):
    return PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now(),
        bug_number=123456,
        bug_updated=datetime.datetime.now())


@pytest.fixture
def test_perf_alert(test_perf_signature, test_perf_alert_summary):
    return PerformanceAlert.objects.create(
        summary=test_perf_alert_summary,
        series_signature=test_perf_signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)


@pytest.fixture
def test_conflicting_perf_alert(test_perf_signature, test_perf_alert_summary_2):
    return PerformanceAlert.objects.create(
        summary=test_perf_alert_summary_2,
        series_signature=test_perf_signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)


@pytest.fixture
def test_perf_alert_2(test_perf_alert, test_perf_signature_2, test_perf_alert_summary_2):
    return PerformanceAlert.objects.create(
        summary=test_perf_alert_summary_2,
        series_signature=test_perf_signature_2,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)


@pytest.fixture
def generic_reference_data(test_repository):
    '''
    Generic reference data (if you want to create a bunch of mock jobs)
    '''
    from treeherder.model.models import (BuildPlatform,
                                         JobGroup,
                                         JobType,
                                         Machine,
                                         MachinePlatform,
                                         Option,
                                         OptionCollection,
                                         Product,
                                         ReferenceDataSignatures)

    class RefdataHolder:
        pass
    r = RefdataHolder()

    r.option = Option.objects.create(name='my_option')
    r.option_collection = OptionCollection.objects.create(
        option_collection_hash='my_option_hash',
        option=r.option)
    r.option_collection_hash = r.option_collection.option_collection_hash
    r.machine_platform = MachinePlatform.objects.create(
        os_name="my_os",
        platform="my_platform",
        architecture="x86")
    r.build_platform = BuildPlatform.objects.create(
        os_name="my_os",
        platform="my_platform",
        architecture="x86")
    r.machine = Machine.objects.create(name='mymachine')
    r.job_group = JobGroup.objects.create(symbol='S', name='myjobgroup')
    r.job_type = JobType.objects.create(symbol='j', name='myjob')
    r.product = Product.objects.create(name='myproduct')
    r.signature = ReferenceDataSignatures.objects.create(
        name='myreferencedatasignaeture',
        signature='1234',
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
        build_system_type='buildbot',
        repository=test_repository.name,
        first_submission_timestamp=0)

    return r


@pytest.fixture
def bug_data(eleven_jobs_stored, test_repository, test_push, bugs):
    from treeherder.model.models import (Job,
                                         BugJobMap,
                                         Option)
    jobs = Job.objects.all()
    bug_id = bugs[0].id
    job_id = jobs[0].id
    BugJobMap.create(job_id=job_id, bug_id=bug_id)
    query_string = '?startday=2012-05-09&endday=2018-05-10&tree={}'.format(
        test_repository.name)

    return {
        'tree': test_repository.name,
        'option': Option.objects.first(),
        'bug_id': bug_id,
        'job': jobs[0],
        'jobs': jobs,
        'query_string': query_string
    }


@pytest.fixture
def test_run_data(bug_data):
    pushes = Push.objects.all()
    time = pushes[0].time.strftime('%Y-%m-%d')
    test_runs = 0
    for push in list(pushes):
        if push.time.strftime('%Y-%m-%d') == time:
            test_runs += 1

    return {
        'test_runs': test_runs,
        'push_time': time
    }


@pytest.fixture
def generate_enough_perf_datum(test_repository, test_perf_signature):
    # generate enough data for a proper alert to be generated (with enough
    # extra data on both sides to make sure we're using the proper values
    # to generate the actual alert)
    for (push_id, job_id, value) in zip([1] * 30 + [2] * 30,
                                        range(1, 61),
                                        [1] * 30 + [2] * 30):
        # push_id == result_set_id == timestamp for purposes of this test
        push = Push.objects.get(id=push_id)
        PerformanceDatum.objects.create(repository=test_repository,
                                        result_set_id=push_id,
                                        push_id=push_id,
                                        signature=test_perf_signature,
                                        value=value,
                                        push_timestamp=push.time)


@pytest.fixture
def sample_option_collections(transactional_db):
    option1 = Option.objects.create(name='opt1')
    option2 = Option.objects.create(name='opt2')
    OptionCollection.objects.create(
        option_collection_hash='option_hash1',
        option=option1)
    OptionCollection.objects.create(
        option_collection_hash='option_hash2',
        option=option2)


@pytest.fixture
def backfill_record_context():
    return {"data_points_to_retrigger": [
        {
            "perf_datum_id": 933219901,
            "value": 0.8714208119774209,
            "job_id": 269034923,
            "push_id": 565159,
            "push_timestamp": "2019-10-02 02:22:28",
            "push__revision": "04e8766a29242d4deae31b5b04e6ac61ebf61ffd"
        },
        {
            "perf_datum_id": 933219962,
            "value": 0.9160434865973892,
            "job_id": 269034920,
            "push_id": 565160,
            "push_timestamp": "2019-10-02 02:23:29",
            "push__revision": "9b42bdc4889fe7782df9b2a0aa990ed5e62cb04c"
        },
        {
            "perf_datum_id": 931772364,
            "value": 0.9508247997807697,
            "job_id": 268828343,
            "push_id": 565161,
            "push_timestamp": "2019-10-02 02:24:35",
            "push__revision": "057b59fdadad75e888a739e85a683b2ff7bfc62e"
        },
        {
            "perf_datum_id": 931924904,
            "value": 0.9829230628232519,
            "job_id": 268840223,
            "push_id": 565188,
            "push_timestamp": "2019-10-02 04:03:09",
            "push__revision": "49ef9afb62bb909389b105a1751e9b46e6f1688d"
        },
        {
            "perf_datum_id": 931927300,
            "value": 0.9873498499464002,
            "job_id": 268840309,
            "push_id": 565193,
            "push_timestamp": "2019-10-02 04:08:06",
            "push__revision": "f5cce52461bac31945b083e51a085fb429a36f04"
        }
    ]}
