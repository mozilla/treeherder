import json
import os

import kombu
import pytest
import responses
from django.conf import settings
from django.core.management import call_command
from requests import Request
from requests_hawk import HawkAuth
from webtest.app import TestApp

from treeherder.client import TreeherderClient
from treeherder.config.wsgi import application
from treeherder.model.derived.jobs import JobsModel


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


@pytest.fixture()
def initial_data(transactional_db):
    call_command('load_initial_data')


@pytest.fixture
def jobs_ds(request, transactional_db):
    from treeherder.model.models import Datasource
    ds = Datasource.objects.create(project=settings.TREEHERDER_TEST_PROJECT)

    def fin():
        ds.delete()
    request.addfinalizer(fin)

    return ds


@pytest.fixture
def jm(request, jobs_ds):
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
    from sampledata import SampleData
    return SampleData()


@pytest.fixture(scope='session')
def test_base_dir():
    return os.path.dirname(__file__)


@pytest.fixture
def sample_resultset(sample_data):
    return sample_data.resultset_data


@pytest.fixture
def test_project(jm):
    return jm.project


@pytest.fixture
def test_repository(jm, transactional_db):
    from treeherder.model.models import Repository, RepositoryGroup

    RepositoryGroup.objects.create(
        name="development",
        active_status="active",
        description=""
    )

    return Repository.objects.create(
        dvcs_type="hg",
        name=jm.project,
        url="https://hg.mozilla.org/mozilla-central",
        active_status="active",
        codebase="gecko",
        repository_group_id=1,
        description=""
    )


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
def result_set_stored(jm, initial_data, sample_resultset, test_repository):

    jm.store_result_set_data(sample_resultset)

    return sample_resultset


@pytest.fixture(scope='function')
def mock_get_resultset(monkeypatch, result_set_stored):
    from treeherder.etl import common

    def _get_resultset(params):
        for k in params:
            rev = params[k][0]
            params[k] = {
                rev: {
                    'id': 1,
                    'revision_hash': result_set_stored[0]['revision_hash']
                }
            }
        return params

    monkeypatch.setattr(common, 'lookup_revisions', _get_resultset)


@pytest.fixture(scope='function')
def refdata(request):
    """returns a patched RefDataManager for testing purpose"""
    from treeherder.model.derived import RefDataManager
    from tests.conftest import add_test_procs_file

    refdata = RefDataManager()

    proc_path = os.path.join(
        os.path.abspath(os.path.dirname(__file__)),
        'refdata_test.json'
    )

    add_test_procs_file(refdata.dhub, 'reference', proc_path)

    def fin():
        refdata.disconnect()

    request.addfinalizer(fin)

    return refdata


@pytest.fixture
def mock_message_broker(monkeypatch):
    from django.conf import settings
    monkeypatch.setattr(settings, 'BROKER_URL', 'memory://')


@pytest.fixture
def resultset_with_three_jobs(jm, sample_data, sample_resultset, test_repository):
    """
    Stores a number of jobs in the same resultset.
    """
    num_jobs = 3
    resultset = sample_resultset[0]
    jobs = sample_data.job_data[0:num_jobs]

    # Only store data for the first resultset....
    resultset_creation = jm.store_result_set_data([resultset])

    blobs = []
    for index, blob in enumerate(jobs):
        # Modify job structure to sync with the resultset sample data
        if 'sources' in blob:
            del blob['sources']

        # Skip log references since they do not work correctly in pending state.
        if 'log_references' in blob['job']:
            del blob['job']['log_references']

        blob['revision_hash'] = resultset['revision_hash']
        blob['job']['state'] = 'pending'
        blobs.append(blob)

    # Store and process the jobs so they are present in the tables.
    jm.store_job_data(blobs)
    return resultset_creation['inserted_result_set_ids'][0]


@pytest.fixture
def eleven_jobs_stored(jm, sample_data, sample_resultset, test_repository, mock_log_parser):
    """stores a list of 11 job samples"""

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

        blob['revision_hash'] = sample_resultset[resultset_index]['revision_hash']

        blobs.append(blob)

        resultset_index += 1

    jm.store_job_data(blobs)


@pytest.fixture
def mock_post_json(monkeypatch, client_credentials):
    def _post_json(th_client, project, endpoint, data, timeout=None):
        auth = th_client.auth
        if not auth:
            auth = HawkAuth(id=client_credentials.client_id,
                            key=str(client_credentials.secret))
        app = TestApp(application)
        uri = th_client._get_project_uri(project, endpoint)
        req = Request('POST', uri, json=data, auth=auth)
        prepped_request = req.prepare()

        getattr(app, 'post')(
            prepped_request.url,
            params=json.dumps(data),
            content_type='application/json',
            extra_environ={
                'HTTP_AUTHORIZATION': str(prepped_request.headers['Authorization'])
            }
        )

    monkeypatch.setattr(TreeherderClient, '_post_json', _post_json)


@pytest.fixture
def mock_fetch_json(monkeypatch):
    def _fetch_json(url, params=None):
        response = TestApp(application).get(url, params=params, status=200)
        return response.json

    import treeherder.etl.common
    monkeypatch.setattr(treeherder.etl.common,
                        'fetch_json', _fetch_json)


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
def pulse_resultset_consumer(request):
    return pulse_consumer('new-result-set', request)


@pytest.fixture
def pulse_action_consumer(request):
    return pulse_consumer('job-actions', request)


@pytest.fixture
def mock_error_summary(monkeypatch):
    bs_obj = ["foo", "bar"]

    from treeherder.model import error_summary

    def _get_error_summary(params):
        return bs_obj

    monkeypatch.setattr(error_summary, "get_error_summary", _get_error_summary)

    return bs_obj


@pytest.fixture
def failure_lines(jm, test_repository, eleven_jobs_stored, initial_data):
    from tests.autoclassify.utils import test_line, create_failure_lines

    test_repository.save()

    job = jm.get_job(1)[0]
    return create_failure_lines(test_repository,
                                job["job_guid"],
                                [(test_line, {}),
                                 (test_line, {"subtest": "subtest2"})])


@pytest.fixture
def classified_failures(request, jm, eleven_jobs_stored, initial_data, failure_lines):
    from treeherder.model.models import ClassifiedFailure, FailureMatch, MatcherManager
    from treeherder.autoclassify import detectors

    job_1 = jm.get_job(1)[0]

    class TreeherderUnitTestDetector(detectors.Detector):
        def __call__(self, failure_lines):
            pass

    test_matcher = MatcherManager._detector_funcs = {}
    test_matcher = MatcherManager._matcher_funcs = {}
    test_matcher = MatcherManager.register_detector(TreeherderUnitTestDetector)

    def finalize():
        MatcherManager._detector_funcs = {}
        MatcherManager._matcher_funcs = {}
    request.addfinalizer(finalize)

    classified_failures = []

    for failure_line in failure_lines:
        if failure_line.job_guid == job_1["job_guid"]:
            classified_failure = ClassifiedFailure()
            classified_failure.save()
            match = FailureMatch(failure_line=failure_line,
                                 classified_failure=classified_failure,
                                 matcher=test_matcher.db_object,
                                 score=1.0)
            match.save()
            classified_failures.append(classified_failure)
            failure_line.best_classification = classified_failure
            failure_line.save()

    return classified_failures


@pytest.fixture
def retriggers(jm, eleven_jobs_stored):
    original = jm.get_job(2)[0]
    retrigger = original.copy()
    retrigger['job_guid'] = "f1c75261017c7c5ce3000931dce4c442fe0a1298"

    jm.execute(proc="jobs_test.inserts.duplicate_job",
               placeholders=[retrigger['job_guid'], original['job_guid']])

    return [retrigger]


@pytest.fixture
def api_user(request, transactional_db):
    from django.contrib.auth.models import User
    user = User.objects.create_user('MyUser')

    def fin():
        user.delete()
    request.addfinalizer(fin)

    return user


@pytest.fixture
def client_credentials(request, api_user):
    from django.conf import settings
    from treeherder.credentials.models import Credentials

    # We need to get_or_create here because of bug 1133273.
    # It can be a straight create once that bug is solved.
    client_credentials, _ = Credentials.objects.get_or_create(
        client_id=settings.ETL_CLIENT_ID,
        defaults={'owner': api_user, 'authorized': True}
    )

    def fin():
        client_credentials.delete()
    request.addfinalizer(fin)

    return client_credentials


@pytest.fixture
def test_perf_signature(test_repository):
    from treeherder.model.models import (MachinePlatform,
                                         Option,
                                         OptionCollection)
    from treeherder.perf.models import (PerformanceFramework,
                                        PerformanceSignature)

    framework = PerformanceFramework.objects.create(
        name='test_talos')
    option = Option.objects.create(name='opt')
    option_collection = OptionCollection.objects.create(
        option_collection_hash='my_option_hash',
        option=option)
    platform = MachinePlatform.objects.create(
        os_name='win',
        platform='win7',
        architecture='x86',
        active_status='active')

    signature = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40*'t'),
        framework=framework,
        platform=platform,
        option_collection=option_collection,
        suite='mysuite',
        test='mytest'
    )
    return signature


@pytest.fixture
def mock_autoclassify_jobs_true(monkeypatch):
    from django.conf import settings
    monkeypatch.setattr(settings, 'AUTOCLASSIFY_JOBS', True)


@pytest.fixture
def mock_extract(monkeypatch):
    """
    mock BzApiBugProcess._get_bz_source_url() to return
    a local sample file
    """
    from treeherder.etl.bugzilla import BzApiBugProcess

    def extract(obj, url):
        tests_folder = os.path.dirname(__file__)
        bug_list_path = os.path.join(
            tests_folder,
            "sample_data",
            "bug_list.json"
        )
        with open(bug_list_path) as f:
            return json.loads(f.read())

    monkeypatch.setattr(BzApiBugProcess,
                        'extract',
                        extract)


@pytest.fixture
def bugs(mock_extract):
    from treeherder.etl.bugzilla import BzApiBugProcess
    from treeherder.model.models import Bugscache

    process = BzApiBugProcess()
    process.run()

    return Bugscache.objects.all()
