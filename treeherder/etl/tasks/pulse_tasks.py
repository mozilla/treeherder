"""
This module contains tasks related to pulse job ingestion
"""
from celery import task

from treeherder.etl.job_loader import JobLoader


@task(name='store-pulse-jobs')
def store_pulse_jobs(job_list):
    """
    Fetches the jobs pending from pulse exchanges and loads them.
    """
    JobLoader().process_job_list(job_list)
