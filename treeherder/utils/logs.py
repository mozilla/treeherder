import contextlib
import logging


@contextlib.contextmanager
def suppress_logs(name):
    """
    Temporarily disable output from the given logger
    """
    logger = logging.getLogger(name)
    current_level = logger.level
    logger.setLevel(logging.NOTSET)

    yield

    logger.setLevel(current_level)
