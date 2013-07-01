import os
from os.path import dirname
import sys
from django.core.management import call_command
import pytest


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


@pytest.fixture()
def jm():
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
        host="localhost",
    )


@pytest.fixture()
def objectstore_ds():
    from django.conf import settings
    from treeherder.model.models import Datasource
    return Datasource.objects.create(
        project=settings.DATABASES["default"]["TEST_NAME"],
        dataset=1,
        contenttype="objectstore",
        host="localhost",
    )


@pytest.fixture(scope='session')
def sample_data():
    """Returns a SampleData() object"""
    from sampledata import SampleData
    return SampleData()
