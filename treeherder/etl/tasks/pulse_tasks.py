"""
This module contains tasks related to pulse job ingestion
"""
import newrelic.agent
from celery import task

from treeherder.etl.job_loader import JobLoader
from treeherder.etl.resultset_loader import ResultsetLoader


@task(name='store-pulse-jobs')
def store_pulse_jobs(job_list, exchange, routing_key):
    """
    Fetches the jobs pending from pulse exchanges and loads them.
    """
    newrelic.agent.add_custom_parameter("exchange", exchange)
    newrelic.agent.add_custom_parameter("routing_key", routing_key)

    JobLoader().process_job_list(job_list)


@task(name='store-pulse-resultsets')
def store_pulse_resultsets(body, exchange, routing_key):
    """
    Fetches the resultsets pending from pulse exchanges and loads them.
    """
    newrelic.agent.add_custom_parameter("exchange", exchange)
    newrelic.agent.add_custom_parameter("routing_key", routing_key)

    ResultsetLoader().process(body, exchange)
