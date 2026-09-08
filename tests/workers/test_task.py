from functools import wraps
from threading import local

import pytest
from celery.exceptions import Retry
from django.db.utils import OperationalError

from treeherder.workers.task import retryable_task

thread_data = local()


def count_retries(f):
    @wraps(f)
    def inner(*args, **kwargs):
        thread_data.retry_count += 1
        return f(*args, **kwargs)

    return inner


@retryable_task()
def successful_task(x, y):
    return x + y


def test_retryable_task():
    "Test celery executes a task properly"

    result = successful_task.delay(7, 3)
    assert result.wait() == 10


def create_throwing_task():
    thread_data.retry_count = 0

    @retryable_task()
    @count_retries
    def throwing_task():
        raise TypeError

    return throwing_task


def test_retryable_task_throws():
    "Test celery immediately raises an error for a task that throws"

    throwing_task = create_throwing_task()

    with pytest.raises(TypeError):
        throwing_task.delay()
    assert thread_data.retry_count == 1


def create_throwing_task_should_retry():
    thread_data.retry_count = 0

    @retryable_task()
    @count_retries
    def throwing_task_should_retry():
        raise OperationalError

    return throwing_task_should_retry


def test_retryable_task_throws_retry():
    "Test celery executes a task properly"

    throwing_task_should_retry = create_throwing_task_should_retry()

    with pytest.raises(Retry) as e:
        throwing_task_should_retry.delay()
    assert str(e.value) == "Retry in 10s: OperationalError()"

    # The task is only called once, the Retry() exception
    # will signal to the worker that the task needs to be tried again later
    assert thread_data.retry_count == 1
