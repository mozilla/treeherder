import random
import zlib
from functools import wraps

import jsonschema
from celery import shared_task
from django.db.utils import IntegrityError, ProgrammingError


class retryable_task:  # noqa: N801
    """Wrapper around a celery task to add conditional task retrying."""

    NON_RETRYABLE_EXCEPTIONS = (
        IndexError,
        IntegrityError,
        jsonschema.ValidationError,
        KeyError,
        ProgrammingError,
        TypeError,
        UnicodeDecodeError,
        ValueError,
        zlib.error,  # eg during log decompression
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
                number_of_prior_retries = task_func.request.retries
                # Implement exponential backoff with some randomness to prevent
                # thundering herd type problems. Constant factor chosen so we get
                # reasonable pause between the fastest retries.
                timeout = 10 * int(random.uniform(1.9, 2.1) ** number_of_prior_retries)
                raise task_func.retry(exc=e, countdown=timeout, throw=False)

        task_func = shared_task(*self.task_args, **self.task_kwargs)(inner)
        return task_func
