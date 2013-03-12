import os


def pytest_sessionstart(session):
    """
Set up the test environment.

Set DJANGO_SETTINGS_MODULE and sets up a test database.

"""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "treeherder.settings.base")

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
    # this sets up a clean test-only database
    session.django_db_config = session.django_runner.setup_databases()


def pytest_sessionfinish(session):
    """Tear down the test environment, including databases."""
    print("\n")

    session.django_runner.teardown_databases(session.django_db_config)
    session.django_runner.teardown_test_environment()


def pytest_runtest_setup(item):
    """
Per-test setup.

Start a transaction and disable transaction methods for the duration of the
test. The transaction will be rolled back after the test. This prevents any
database changes made to Django ORM models from persisting between tests,
providing test isolation.

"""
    from django.test.testcases import disable_transaction_methods
    from django.db import transaction

    transaction.enter_transaction_management()
    transaction.managed(True)
    disable_transaction_methods()


def pytest_runtest_teardown(item):
    """
Per-test teardown.

Roll back the Django ORM transaction

"""
    from django.test.testcases import restore_transaction_methods
    from django.db import transaction

    restore_transaction_methods()
    transaction.rollback()
    transaction.leave_transaction_management()
