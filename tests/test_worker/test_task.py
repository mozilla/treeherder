from functools import wraps
from threading import local

import pytest
from django.db.utils import OperationalError

from treeherder.workers.task import retryable_task

thread_data = local()


def count_retries(f):
    thread_data.retry_count = -1

    @wraps(f)
    def inner():
        thread_data.retry_count += 1
        f()

    return inner


@retryable_task()
def successful_task(x, y):
    return x + y


def test_retryable_task():
    "Test celery executes a task properly"

    result = successful_task.delay(7, 3)
    assert result.wait() == 10


@retryable_task()
@count_retries
def throwing_task():
    raise TypeError


def test_retryable_task_throws():
    "Test celery immediately raises an error for a task that throws"

    with pytest.raises(TypeError):
        throwing_task.delay()
    assert thread_data.retry_count == 0


@retryable_task()
@count_retries
def throwing_task_should_retry():
    raise OperationalError


def test_retryable_task_throws_retry():
    "Test celery executes a task properly"

    with pytest.raises(OperationalError):
        throwing_task_should_retry.delay()
    assert thread_data.retry_count > 1
