"""
This module contains
"""
from celery import task

from treeherder.etl.bugzilla import BzApiBugProcess


@task(name='fetch-bugs', time_limit=10 * 60)
def fetch_bugs():
    """
    Run a BzApiBug process
    """
    process = BzApiBugProcess()
    process.run()
