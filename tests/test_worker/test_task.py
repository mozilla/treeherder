import pytest

from treeherder.workers.task import retryable_task


@retryable_task()
def successful_task(x, y):
    return x + y


def test_retryable_task():
    "Test celery executes a task properly"

    result = successful_task.delay(7, 3)
    assert result.wait() == 10


@retryable_task()
def throwing_task(x, y):
    raise TypeError


def test_retryable_task_throws():
    "Test celery executes a task properly"

    with pytest.raises(TypeError):
        throwing_task.delay(7, 3)
