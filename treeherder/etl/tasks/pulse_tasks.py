"""
This module contains tasks related to pulse job ingestion
"""
import newrelic.agent

from treeherder.etl.job_loader import JobLoader
from treeherder.etl.push_loader import PushLoader
from treeherder.workers.task import retryable_task


@retryable_task(name='store-pulse-jobs', max_retries=10)
def store_pulse_jobs(job_list, exchange, routing_key):
    """
    Fetches the jobs pending from pulse exchanges and loads them.
    """
    newrelic.agent.add_custom_parameter("exchange", exchange)
    newrelic.agent.add_custom_parameter("routing_key", routing_key)

    JobLoader().process_job_list(job_list)


@retryable_task(name='store-pulse-resultsets', max_retries=10)
def store_pulse_resultsets(body, exchange, routing_key):
    """
    Fetches the pushes pending from pulse exchanges and loads them.
    """
    newrelic.agent.add_custom_parameter("exchange", exchange)
    newrelic.agent.add_custom_parameter("routing_key", routing_key)

    PushLoader().process(body, exchange)
