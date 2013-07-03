import pytest
from treeherder.log_parser import tasks
from celery import task


@task
def task_mock(*args, **kwargs):
    pass


@pytest.fixture
def mock_log_parser():
    old_func = tasks.parse_log
    tasks.parse_log = task_mock

    def fin():
        tasks.parse_log = old_func
