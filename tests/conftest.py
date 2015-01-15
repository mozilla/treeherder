# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import os
from os.path import dirname
import sys
import json

import pytest
from django.core.management import call_command
from webtest.app import TestApp
import responses

from thclient.client import TreeherderRequest

from tests.sampledata import SampleData
from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.webapp.wsgi import application


def pytest_addoption(parser):
    parser.addoption(
        "--runslow",
        action="store_true",
        help="run slow tests",
    )


def pytest_sessionstart(session):
    """
    Set up the test environment.

    Set DJANGO_SETTINGS_MODULE and sets up a test database.

    """
    sys.path.append(dirname(dirname(__file__)))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "treeherder.settings")
    from django.conf import settings
    from django.test.simple import DjangoTestSuiteRunner

    # we don't actually let Django run the tests, but we need to use some
    # methods of its runner for setup/teardown of dbs and some other things
    session.django_runner = DjangoTestSuiteRunner()
    # this provides templates-rendered debugging info and locmem mail storage
    session.django_runner.setup_test_environment()
    # support custom db prefix for tests for the main datazilla datasource
    # as well as for the testproj and testpushlog dbs
    prefix = getattr(settings, "TEST_DB_PREFIX", "")
    settings.DATABASES["default"]["TEST_NAME"] = "{0}test_treeherder".format(prefix)

    # this makes celery calls synchronous, useful for unit testing
    settings.CELERY_ALWAYS_EAGER = True
    settings.CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

    settings.TBPL_BUGS_TRANSFER_ENABLED = False

    # this sets up a clean test-only database
    session.django_db_config = session.django_runner.setup_databases()

def pytest_sessionfinish(session):
    """Tear down the test environment, including databases."""
    session.django_runner.teardown_databases(session.django_db_config)
    session.django_runner.teardown_test_environment()


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

    # this should provide isolation between tests.
    call_command("init_master_db", interactive=False, skip_fixtures=True)


def pytest_runtest_teardown(item):
    """
    Per-test teardown.

    Roll back the Django ORM transaction and delete all the dbs created
    between tests

    """

    from treeherder.model.models import Datasource

    ds_list = Datasource.objects.all()
    for ds in ds_list:
        ds.delete()

    call_command("migrate", 'model', '0001_initial')




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
def initial_data():
    from django.core.management import call_command

    call_command('load_initial_data')

@pytest.fixture(scope='function')
def jm(request):
    """ Give a test access to a JobsModel instance. """
    from django.conf import settings
    from treeherder.model.derived.jobs import JobsModel
    model = JobsModel.create(settings.DATABASES["default"]["TEST_NAME"])

    # patch in additional test-only procs on the datasources
    add_test_procs_file(
        model.get_dhub("objectstore"),
        model.get_datasource("objectstore").key,
        "objectstore_test.json",
    )
    add_test_procs_file(
        model.get_dhub("jobs"),
        model.get_datasource("jobs").key,
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
    if not test_proc_file in proclist:
        proclist.append(test_proc_file)
    dhub.data_sources[key]["procs"] = proclist
    dhub.load_procs(key)


@pytest.fixture()
def jobs_ds():
    from django.conf import settings
    from treeherder.model.models import Datasource
    return Datasource.objects.create(
        project=settings.DATABASES["default"]["TEST_NAME"],
        dataset=1,
        contenttype="jobs",
        host=settings.TREEHERDER_DATABASE_HOST,
    )


@pytest.fixture()
def objectstore_ds():
    from django.conf import settings
    from treeherder.model.models import Datasource
    return Datasource.objects.create(
        project=settings.DATABASES["default"]["TEST_NAME"],
        dataset=1,
        contenttype="objectstore",
        host=settings.TREEHERDER_DATABASE_HOST,
    )


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
def test_repository():
    from django.conf import settings
    from treeherder.model.models import Repository, RepositoryGroup

    RepositoryGroup.objects.create(
        name = "development",
        active_status = "active",
        description = ""
    )

    return Repository.objects.create(
        dvcs_type = "hg",
        name = settings.DATABASES["default"]["TEST_NAME"],
        url = "https://hg.mozilla.org/mozilla-central",
        active_status = "active",
        codebase = "gecko",
        repository_group_id = 1,
        description = ""
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
def result_set_stored(jm, initial_data, sample_resultset):

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

    import os
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
def eleven_jobs_stored(jm, sample_data, sample_resultset):
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
def eleven_jobs_processed(jm, mock_log_parser, eleven_jobs_stored):
    """stores and processes list of 11 job samples"""
    jm.process_objects(11, raise_errors=True)


@pytest.fixture
def set_oauth_credentials():
    OAuthCredentials.set_credentials(SampleData.get_credentials())

@pytest.fixture
def mock_send_request(monkeypatch, set_oauth_credentials):
    def _send(th_request, endpoint,  method=None, data=None):

        if data and not isinstance(data, str):
            data = json.dumps(data)

        signed_uri = th_request.oauth_client.get_signed_uri(
            data, th_request.get_uri(endpoint), method
        )

        response = getattr(TestApp(application), method.lower())(
            str(signed_uri),
            params=data,
            content_type='application/json'
        )

        response.getcode = lambda: response.status_int
        return response

    monkeypatch.setattr(TreeherderRequest, 'send', _send)


@pytest.fixture
def mock_get_remote_content(monkeypatch):
    def _get_remote_content(url):
        response = TestApp(application).get(url)
        if response.status_int != 200:
            return None
        else:
            return response.json

    import treeherder.etl.common
    monkeypatch.setattr(treeherder.etl.common,
                        'get_remote_content', _get_remote_content)


@pytest.fixture
def activate_responses(request):

    responses.start()

    def fin():
        responses.reset()
        responses.stop()

    request.addfinalizer(fin)
