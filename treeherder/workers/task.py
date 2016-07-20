import random
import zlib
from functools import wraps

import newrelic.agent
from celery import task
from django.db.utils import (IntegrityError,
                             ProgrammingError)


class retryable_task(object):
    """Wrapper around a celery task to add conditional task retrying."""

    NON_RETRYABLE_EXCEPTIONS = (
        TypeError,
        IntegrityError,
        ProgrammingError,
        # eg during log decompression
        zlib.error,
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
                # Whilst the New Relic agent does report the exception that caused a retry,
                # it does so in a form like:
                #   `celery.exceptions:Retry: Retry in 640s: error('Error -3 while decompressing: incorrect header check',)`
                # ...which causes all retry exceptions to be lumped together in the same
                # `celery.exceptions:Retry` group. The original exception is then only
                # reported to New Relic once the max number of retries has been reached.
                # As such we manually report the retried exceptions to New Relic here, so
                # that the original exception is shown verbatim immediately, and then filter
                # out the automatic `celery.exceptions:Retry` exceptions via the web UI. See:
                # https://docs.newrelic.com/docs/agents/python-agent/back-end-services/python-agent-celery#ignoring-task-retry-errors
                params = {
                    "number_of_prior_retries": number_of_prior_retries,
                }
                newrelic.agent.record_exception(params=params)
                # Implement exponential backoff with some randomness to prevent
                # thundering herd type problems. Constant factor chosen so we get
                # reasonable pause between the fastest retries.
                timeout = 10 * int(random.uniform(1.9, 2.1) ** number_of_prior_retries)
                raise task_func.retry(exc=e, countdown=timeout)

        task_func = task(*self.task_args, **self.task_kwargs)(inner)
        return task_func
