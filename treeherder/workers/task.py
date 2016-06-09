import random
from functools import wraps

from celery import task
from django.db.utils import IntegrityError


class retryable_task(object):
    def __init__(self, *args, **kwargs):
        self.raise_exceptions = kwargs.pop("raise_exceptions", (TypeError, IntegrityError))
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
                f.retry(exc=e, countdown=10 * int(random.uniform(2, 3) ** f.request.retries))

        return task(*self.task_args, **self.task_kwargs)(inner)
