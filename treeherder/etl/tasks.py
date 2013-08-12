"""
This module contains
"""
from celery import task
from treeherder.etl.buildapi import RunningJobsProcess, PendingJobsProcess


@task(name='fetch-buildapi-pending')
def fetch_buildapi_pending(url):
    """
    Fetches the buildapi pending jobs api and load them to
    the objectstore ingestion endpoint
    """
    PendingJobsProcess().run()


@task(name='fetch-buildapi-running')
def fetch_buildapi_pending(url):
    """
    Fetches the buildapi running jobs api and load them to
    the objectstore ingestion endpoint
    """
    RunningJobsProcess().run()
