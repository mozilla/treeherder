import random
from functools import wraps

from celery import task
from django.db.utils import (IntegrityError,
                             ProgrammingError)


class retryable_task(object):
    """Wrapper around a celery task to add conditional task retrying."""

    NON_RETRYABLE_EXCEPTIONS = (
        TypeError,
        IntegrityError,
        ProgrammingError,
    )

    def __init__(self, *args, **kwargs):
        self.task_args = args
        self.task_kwargs = kwargs

    def __call__(self, f):
        @wraps(f)
        def inner(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except self.NON_RETRYABLE_EXCEPTIONS:
                raise
            except Exception as e:
                # Implement exponential backoff with some randomness to prevent
                # thundering herd type problems. Constant factor chosen so we get
                # reasonable pause between the fastest retries.
                timeout = 10 * int(random.uniform(1.9, 2.1) ** task_func.request.retries)
                raise task_func.retry(exc=e, countdown=timeout)

        task_func = task(*self.task_args, **self.task_kwargs)(inner)
        return task_func
