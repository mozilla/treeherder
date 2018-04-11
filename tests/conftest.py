import copy
import datetime
import json
import os

import kombu
import pytest
import responses
from _pytest.monkeypatch import MonkeyPatch
from django.conf import settings
from requests import Request
from requests_hawk import HawkAuth
from rest_framework.test import APIClient

from treeherder.client.thclient import TreeherderClient
from treeherder.etl.jobs import store_job_data
from treeherder.etl.push import store_push_data
from treeherder.model.models import (Commit,
                                     JobNote,
                                     Push,
                                     TextLogErrorMetadata)


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
def elasticsearch(request):
    from treeherder.model.search import connection, doctypes, refresh_all

    for item in doctypes():
        connection.indices.delete(item._doc_type.index, ignore=404)
        refresh_all()
        item.init()


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
        expire_performance_data=False
    )
    return r


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
def mock_message_broker(monkeypatch):
    monkeypatch.setattr(settings, 'BROKER_URL', 'memory://')


@pytest.fixture
def push_with_three_jobs(sample_data, sample_push, test_repository):
    """
    Stores a number of jobs in the same push.
    """
    num_jobs = 3
    push = sample_push[0]
    jobs = copy.deepcopy(sample_data.job_data[0:num_jobs])

    # Only store data for the first push....
    store_push_data(test_repository, [push])

    blobs = []
    for blob in jobs:
        # Modify job structure to sync with the push sample data
        if 'sources' in blob:
            del blob['sources']

        # Skip log references since they do not work correctly in pending state.
        if 'log_references' in blob['job']:
            del blob['job']['log_references']

        blob['revision'] = push['revision']
        blob['job']['state'] = 'pending'
        blobs.append(blob)

    # Store and process the jobs so they are present in the tables.
    store_job_data(test_repository, blobs)
    return Push.objects.get(repository=test_repository,
                            revision=push['revision'])


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
def mock_post_json(monkeypatch, client_credentials, client):
    def _post_json(th_client, project, endpoint, data):
        auth = th_client.session.auth
        if not auth:
            auth = HawkAuth(id=client_credentials.client_id,
                            key=str(client_credentials.secret))
        url = th_client._get_endpoint_url(endpoint, project=project)
        req = Request('POST', url, json=data, auth=auth)
        prepped_request = req.prepare()
        response = client.post(
            prepped_request.url,
            data=json.dumps(data),
            content_type='application/json',
            HTTP_AUTHORIZATION=str(prepped_request.headers['Authorization'])
        )
        # Replacement for the `raise_for_status()` in the original `_post_json()`
        assert response.status_code == 200
        return response

    monkeypatch.setattr(TreeherderClient, '_post_json', _post_json)


@pytest.fixture
def activate_responses(request):

    responses.start()

    def fin():
        responses.reset()
        responses.stop()

    request.addfinalizer(fin)


def pulse_consumer(exchange, request):
    exchange_name = 'exchange/{}/v1/{}'.format(
        settings.PULSE_EXCHANGE_NAMESPACE,
        exchange
    )

    connection = kombu.Connection(settings.PULSE_URI)

    exchange = kombu.Exchange(
        name=exchange_name,
        type='topic'
    )

    queue = kombu.Queue(
        no_ack=True,
        exchange=exchange,  # Exchange name
        routing_key='#',  # Bind to all messages
        auto_delete=True,  # Delete after each test
        exclusive=False)  # Disallow multiple consumers

    simpleQueue = connection.SimpleQueue(
        name=queue,
        channel=connection,
        no_ack=True)

    def fin():
        connection.release()

    request.addfinalizer(fin)
    return simpleQueue


@pytest.fixture
def pulse_action_consumer(request):
    return pulse_consumer('job-actions', request)


@pytest.fixture
def failure_lines(test_job, elasticsearch):
    from tests.autoclassify.utils import test_line, create_failure_lines

    return create_failure_lines(test_job,
                                [(test_line, {}),
                                 (test_line, {"subtest": "subtest2"})])


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
    from treeherder.autoclassify import detectors
    from treeherder.model.models import MatcherManager

    class TreeherderUnitTestDetector(detectors.Detector):
        def __call__(self, failure_lines):
            return True

    MatcherManager._detector_funcs = {}
    MatcherManager._matcher_funcs = {}
    test_matcher = MatcherManager.register_detector(TreeherderUnitTestDetector)

    def finalize():
        MatcherManager._detector_funcs = {}
        MatcherManager._matcher_funcs = {}
    request.addfinalizer(finalize)

    return test_matcher


@pytest.fixture
def classified_failures(test_job, text_log_errors_failure_lines, test_matcher,
                        failure_classifications):
    from treeherder.model.models import ClassifiedFailure
    from treeherder.model.search import refresh_all

    _, failure_lines = text_log_errors_failure_lines

    classified_failures = []

    for failure_line in failure_lines:
        if failure_line.job_guid == test_job.guid:
            classified_failure = ClassifiedFailure()
            classified_failure.save()
            failure_line.set_classification(test_matcher.db_object,
                                            classified_failure,
                                            mark_best=True)
            classified_failures.append(classified_failure)

    refresh_all()
    return classified_failures


@pytest.fixture
def test_user(request, transactional_db):
    # a user *without* sheriff/staff permissions
    from django.contrib.auth.models import User
    user = User.objects.create(username="testuser1",
                               email='user@foo.com',
                               is_staff=False)

    def fin():
        user.delete()
    request.addfinalizer(fin)

    return user


@pytest.fixture
def test_ldap_user(request, transactional_db):
    # a user *without* sheriff/staff permissions
    from django.contrib.auth.models import User
    user = User.objects.create(username="mozilla-ldap/user@foo.com",
                               email='user@foo.com',
                               is_staff=False)

    def fin():
        user.delete()
    request.addfinalizer(fin)

    return user


@pytest.fixture
def test_sheriff(request, transactional_db):
    # a user *with* sheriff/staff permissions
    from django.contrib.auth.models import User

    user = User.objects.create(username="testsheriff1",
                               email='sheriff@foo.com',
                               is_staff=True)

    def fin():
        user.delete()
    request.addfinalizer(fin)

    return user


@pytest.fixture
def client_credentials(request, transactional_db):
    from treeherder.credentials.models import Credentials

    client_credentials = Credentials.objects.create(
        client_id='test_client',
        authorized=True
    )

    def fin():
        client_credentials.delete()
    request.addfinalizer(fin)

    return client_credentials


@pytest.fixture
def test_perf_framework(transactional_db):
    from treeherder.perf.models import PerformanceFramework
    return PerformanceFramework.objects.create(
        name='test_talos', enabled=True)


@pytest.fixture
def test_perf_signature(test_repository, test_perf_framework):
    from treeherder.model.models import (MachinePlatform,
                                         Option,
                                         OptionCollection)
    from treeherder.perf.models import PerformanceSignature

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
        has_subtests=False,
        extra_options='e10s opt',
        last_updated=datetime.datetime.now()
    )
    return signature


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
def text_log_error_lines(test_job, failure_lines):
    from tests.autoclassify.utils import create_text_log_errors
    from treeherder.model.models import FailureLine

    lines = [(item, {}) for item in FailureLine.objects.filter(job_guid=test_job.guid).values()]

    errors = create_text_log_errors(test_job, lines)

    return errors


@pytest.fixture
def test_perf_alert_summary(test_repository, push_stored, test_perf_framework):
    from treeherder.perf.models import PerformanceAlertSummary
    return PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        last_updated=datetime.datetime.now())


@pytest.fixture
def test_perf_alert(test_perf_signature, test_perf_alert_summary):
    from treeherder.perf.models import PerformanceAlert
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

    class RefdataHolder(object):
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
