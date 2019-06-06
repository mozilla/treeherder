"""
This module contains tasks related to pulse job ingestion
"""
import newrelic.agent

from treeherder.etl.job_loader import JobLoader
from treeherder.etl.push_loader import PushLoader
from treeherder.etl.taskcluster_pulse.handler import handleMessage
from treeherder.workers.task import retryable_task


@retryable_task(name='store-pulse-jobs', max_retries=10)
def store_pulse_jobs(pulse_job, exchange, routing_key):
    """
    Fetches the jobs pending from pulse exchanges and loads them.
    """
    newrelic.agent.add_custom_parameter("exchange", exchange)
    newrelic.agent.add_custom_parameter("routing_key", routing_key)
    # handleMessage expects messages in this format
    runs = handleMessage({
        "exchange": exchange,
        "payload": pulse_job,
    })
    for run in runs:
        JobLoader().process_job(run)


@retryable_task(name='store-pulse-pushes', max_retries=10)
def store_pulse_pushes(body, exchange, routing_key):
    """
    Fetches the pushes pending from pulse exchanges and loads them.
    """
    newrelic.agent.add_custom_parameter("exchange", exchange)
    newrelic.agent.add_custom_parameter("routing_key", routing_key)

    PushLoader().process(body, exchange)
