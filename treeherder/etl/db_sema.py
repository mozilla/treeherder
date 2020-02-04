from threading import BoundedSemaphore

from django.conf import settings
from django.db import connection

# Semaphore to limit the number of threads opening DB connections when processing jobs
conn_sem = BoundedSemaphore(settings.CONN_RESOURCES)


def acquire_connection():
    """
    Decrement database resource count. If resource count is 0, block thread
    until resource count becomes 1 before decrementing again.
    """
    conn_sem.acquire()


def release_connection():
    """
    Close thread's conneciton to database and increment database resource count.
    """
    connection.close()
    conn_sem.release()
