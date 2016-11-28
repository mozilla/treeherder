import copy
import datetime
import json
import os

import kombu
import pytest
import responses
from django.conf import settings
from requests import Request
from requests_hawk import HawkAuth
from webtest.app import TestApp

from treeherder.client import TreeherderClient
from treeherder.config.wsgi import application
from treeherder.model.derived.jobs import JobsModel
from treeherder.model.models import Push


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
    - Provide cache isolation incrementing the cache key prefix
    - Drop and recreate tables in the master db
    """

    if 'slow' in item.keywords and not item.config.getoption("--runslow"):
        pytest.skip("need --runslow option to run")

    increment_cache_key_prefix()


def increment_cache_key_prefix():
    """Increment a cache prefix to effectively clear the cache."""
    from django.core.cache import cache
    cache.key_prefix = ""
    prefix_counter_cache_key = "treeherder-tests-key-prefix-counter"
    try:
        key_prefix_counter = cache.incr(prefix_counter_cache_key)
    except ValueError:
        key_prefix_counter = 0
        cache.set(prefix_counter_cache_key, key_prefix_counter)
    cache.key_prefix = "t{0}".format(key_prefix_counter)


@pytest.fixture
def elasticsearch(request):
    from treeherder.model.search import connection, doctypes, refresh_all

    for item in doctypes():
        connection.indices.delete(item._doc_type.index, ignore=404)
        refresh_all()
        item.init()


@pytest.fixture
def jobs_ds(request, transactional_db):
    from treeherder.model.models import Datasource
    ds = Datasource.objects.create(project=settings.TREEHERDER_TEST_PROJECT)

    def fin():
        ds.delete()
    request.addfinalizer(fin)

    return ds


@pytest.fixture
def jm(request, test_repository, jobs_ds):
    """ Give a test access to a JobsModel instance. """
    model = JobsModel(jobs_ds.project)

    # patch in additional test-only procs on the datasources
    add_test_procs_file(
        model.get_dhub(),
        model.get_datasource().key,
        "jobs_test.json",
    )

    def fin():
        model.disconnect()
    request.addfinalizer(fin)

    return model


def add_test_procs_file(dhub, key, filename):
    """Add an extra procs file in for testing purposes."""
    test_proc_file = os.path.join(
        os.path.abspath(os.path.dirname(__file__)),
        filename,
    )
    del dhub.procs[key]
    proclist = dhub.data_sources[key]["procs"]
    if test_proc_file not in proclist:
        proclist.append(test_proc_file)
    dhub.data_sources[key]["procs"] = proclist
    dhub.load_procs(key)


@pytest.fixture(scope='session')
def sample_data():
    """Returns a SampleData() object"""
    from .sampledata import SampleData
    return SampleData()


@pytest.fixture(scope='session')
def test_base_dir():
    return os.path.dirname(__file__)


@pytest.fixture
def sample_resultset(sample_data):
    return copy.deepcopy(sample_data.resultset_data)


@pytest.fixture
def test_project(jm):
    return jm.project


@pytest.fixture
def test_repository(transactional_db):
    from treeherder.model.models import Repository, RepositoryGroup

    RepositoryGroup.objects.create(
        name="development",
        description=""
    )

    r = Repository.objects.create(
        dvcs_type="hg",
        name=settings.TREEHERDER_TEST_PROJECT,
        url="https://hg.mozilla.org/mozilla-central",
        active_status="active",
        codebase="gecko",
        repository_group_id=1,
        description="",
        performance_alerts_enabled=True
    )
    return r


@pytest.fixture
def test_job(failure_classifications, eleven_job_blobs, jm):
    from treeherder.model.models import Job

    jm.store_job_data(eleven_job_blobs[0:1])

    return Job.objects.get(id=1)


@pytest.fixture
def test_job_2(eleven_job_blobs, test_job, jm):
    from treeherder.model.models import Job

    jm.store_job_data(eleven_job_blobs[1:2])

    return Job.objects.get(id=2)


@pytest.fixture
def mock_log_parser(monkeypatch):
    from celery import task
    from treeherder.log_parser import tasks

    @task
    def task_mock(*args, **kwargs):
        pass

    monkeypatch.setattr(tasks,
                        'parse_log',
                        task_mock)


@pytest.fixture
def result_set_stored(jm, sample_resultset):
    jm.store_result_set_data(sample_resultset)

    return sample_resultset


@pytest.fixture
def mock_message_broker(monkeypatch):
    from django.conf import settings
    monkeypatch.setattr(settings, 'BROKER_URL', 'memory://')


@pytest.fixture
def push_with_three_jobs(jm, sample_data, sample_resultset, test_repository):
    """
    Stores a number of jobs in the same resultset.
    """
    num_jobs = 3
    resultset = sample_resultset[0]
    jobs = copy.deepcopy(sample_data.job_data[0:num_jobs])

    # Only store data for the first resultset....
    jm.store_result_set_data([resultset])

    blobs = []
    for index, blob in enumerate(jobs):
        # Modify job structure to sync with the resultset sample data
        if 'sources' in blob:
            del blob['sources']

        # Skip log references since they do not work correctly in pending state.
        if 'log_references' in blob['job']:
            del blob['job']['log_references']

        blob['revision'] = resultset['revision']
        blob['job']['state'] = 'pending'
        blobs.append(blob)

    # Store and process the jobs so they are present in the tables.
    jm.store_job_data(blobs)
    return Push.objects.get(repository=test_repository,
                            revision=resultset['revision'])


@pytest.fixture
def eleven_job_blobs(jm, sample_data, sample_resultset, test_repository, mock_log_parser):
    jm.store_result_set_data(sample_resultset)

    num_jobs = 11
    jobs = sample_data.job_data[0:num_jobs]

    max_index = len(sample_resultset) - 1
    resultset_index = 0

    blobs = []
    for index, blob in enumerate(jobs):

        if resultset_index > max_index:
            resultset_index = 0

        # Modify job structure to sync with the resultset sample data
        if 'sources' in blob:
            del blob['sources']

        blob['revision'] = sample_resultset[resultset_index]['revision']

        blobs.append(blob)

        resultset_index += 1
    return blobs


@pytest.fixture
def eleven_jobs_stored(jm, failure_classifications, eleven_job_blobs):
    """stores a list of 11 job samples"""
    jm.store_job_data(eleven_job_blobs)


@pytest.fixture
def mock_post_json(monkeypatch, client_credentials):
    def _post_json(th_client, project, endpoint, data):
        auth = th_client.session.auth
        if not auth:
            auth = HawkAuth(id=client_credentials.client_id,
                            key=str(client_credentials.secret))
        app = TestApp(application)
        url = th_client._get_endpoint_url(endpoint, project=project)
        req = Request('POST', url, json=data, auth=auth)
        prepped_request = req.prepare()

        return getattr(app, 'post')(
            prepped_request.url,
            params=json.dumps(data),
            content_type='application/json',
            extra_environ={
                'HTTP_AUTHORIZATION': str(prepped_request.headers['Authorization'])
            }
        )

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
def classified_failures(test_job, failure_lines, test_matcher,
                        failure_classifications):
    from treeherder.model.models import ClassifiedFailure
    from treeherder.model.search import refresh_all

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
def retriggered_job(test_job, jm, eleven_job_blobs):
    # a copy of test_job with a different guid, representing a "retrigger"
    from treeherder.model.models import Job
    original = eleven_job_blobs[0]
    retrigger = copy.deepcopy(original)
    retrigger['job']['job_guid'] = "f1c75261017c7c5ce3000931dce4c442fe0a129a"

    jm.store_job_data([retrigger])

    return Job.objects.get(guid=retrigger['job']['job_guid'])


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
        last_updated=datetime.datetime.now()
    )
    return signature


@pytest.fixture
def mock_autoclassify_jobs_true(monkeypatch):
    from django.conf import settings
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
def text_log_error_lines(test_job, failure_lines):
    from treeherder.model.models import FailureLine
    from autoclassify.utils import create_text_log_errors

    lines = [(item, {}) for item in FailureLine.objects.filter(job_guid=test_job.guid).values()]

    errors = create_text_log_errors(test_job, lines)

    return errors


@pytest.fixture
def text_summary_lines(test_job, failure_lines, text_log_error_lines):
    from treeherder.model.models import TextLogSummary, TextLogSummaryLine

    summary = TextLogSummary(
        job_guid=test_job.guid,
        repository=test_job.repository
    )
    summary.save()

    summary_lines = []
    for line in failure_lines:
        summary_line = TextLogSummaryLine(
            summary=summary,
            line_number=line.line,
            failure_line=line)
        summary_line.save()
        summary_lines.append(summary_line)

    return summary_lines


@pytest.fixture
def test_perf_alert_summary(test_repository, result_set_stored, test_perf_framework):
    from treeherder.perf.models import PerformanceAlertSummary
    return PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_result_set_id=1,
        result_set_id=2,
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
    r.job_type = JobType.objects.create(job_group=r.job_group,
                                        symbol='j', name='myjob')
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
