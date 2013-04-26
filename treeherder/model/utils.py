import time
import datetime
import sys


def get_now_timestamp():
    """
    Return a unix timestamp for the current time.

    This is useful because it can be mocked out in unit tests.
    """
    return int(time.time())


