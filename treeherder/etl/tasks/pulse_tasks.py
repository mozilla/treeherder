"""
This module contains tasks related to pulse job ingestion
"""
import asyncio

import newrelic.agent

from treeherder.etl.classification_loader import ClassificationLoader
from treeherder.etl.job_loader import JobLoader
from treeherder.etl.push_loader import PushLoader
from treeherder.etl.taskcluster_pulse.handler import handle_message
from treeherder.workers.task import retryable_task

# NOTE: default values for root_url parameters can be removed once all tasks that lack
# that parameter have been processed


@retryable_task(name="store-pulse-tasks", max_retries=10)
def store_pulse_tasks(
    pulse_job, exchange, routing_key, root_url="https://firefox-ci-tc.services.mozilla.com"
):
    """
    Fetches tasks from Taskcluster
    """
    loop = asyncio.get_event_loop()
    newrelic.agent.add_custom_attribute("exchange", exchange)
    newrelic.agent.add_custom_attribute("routing_key", routing_key)
    # handle_message expects messages in this format
    runs = loop.run_until_complete(
        handle_message(
            {
                "exchange": exchange,
                "payload": pulse_job,
                "root_url": root_url,
            }
        )
    )
    for run in runs:
        if run:
            JobLoader().process_job(run, root_url)


@retryable_task(name="store-pulse-pushes", max_retries=10)
def store_pulse_pushes(
    body, exchange, routing_key, root_url="https://firefox-ci-tc.services.mozilla.com"
):
    """
    Fetches the pushes pending from pulse exchanges and loads them.
    """
    newrelic.agent.add_custom_attribute("exchange", exchange)
    newrelic.agent.add_custom_attribute("routing_key", routing_key)

    PushLoader().process(body, exchange, root_url)


@retryable_task(name="store-pulse-pushes-classification", max_retries=10)
def store_pulse_tasks_classification(
    pulse_job, exchange, routing_key, root_url="https://community-tc.services.mozilla.com"
):
    """
    Fetches the Mozci classification associated to a task from Taskcluster

    By default, it should listen to the Community cluster as classifications
    are only running there for the moment
    """
    newrelic.agent.add_custom_attribute("exchange", exchange)
    newrelic.agent.add_custom_attribute("routing_key", routing_key)

    ClassificationLoader().process(pulse_job, root_url)
