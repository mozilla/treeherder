import random
import time

from _mysql_exceptions import OperationalError


def get_now_timestamp():
    """
    Return a unix timestamp for the current time.

    This is useful because it can be mocked out in unit tests.
    """
    return int(time.time())


def retry_execute(dhub, logger, retries=0, **kwargs):
    """Retry the query in the case of an OperationalError."""
    try:
        return dhub.execute(**kwargs)
    except OperationalError as e:

        if retries < 20:
            retries += 1
            sleep_time = round(random.random() * .05, 3)  # 0 to 50ms
            if logger:
                logger.info(
                    "MySQL operational error `{}` hit.  Retry #{} in {}s: {}".format(
                        str(e), retries, sleep_time, kwargs
                    ))
            time.sleep(sleep_time)
            return retry_execute(dhub, logger, retries, **kwargs)
        else:
            raise
