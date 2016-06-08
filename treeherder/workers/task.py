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
                f.retry(exc=e, countdown=(1 + f.request.retries) * 60)

        return task(*self.task_args, **self.task_kwargs)(inner)
