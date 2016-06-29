import random
from functools import wraps

import newrelic.agent
from celery import task
from django.db.utils import (IntegrityError,
                             ProgrammingError)


class retryable_task(object):
    def __init__(self, *args, **kwargs):
        self.raise_exceptions = kwargs.pop("raise_exceptions", (TypeError, IntegrityError,
                                                                ProgrammingError))
        self.task_args = args
        self.task_kwargs = kwargs

    def __call__(self, f):
        @wraps(f)
        def inner(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except self.raise_exceptions:
                raise
            except Exception as e:
                # Implement exponential backoff with some randomness to prevent
                # thundering herd type problems. Constant factor chosen so we get
                # reasonable pause between the fastest retries.
                if task_func.request.retries == 0:
                    newrelic.agent.record_exception()
                timeout = 10 * int(random.uniform(1.9, 2.1) ** task_func.request.retries)
                task_func.retry(exc=e, countdown=timeout)

        task_func = task(*self.task_args, **self.task_kwargs)(inner)
        return task_func
