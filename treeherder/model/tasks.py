import os
import time

import newrelic.agent
from celery import task
from django.conf import settings
from django.core.management import call_command

from treeherder.model.exchanges import TreeherderPublisher
from treeherder.model.models import (Job,
                                     Repository)
from treeherder.model.pulse_publisher import load_schemas

# Load schemas for validation of messages published on pulse
SOURCE_FOLDER = os.path.dirname(os.path.realpath(__file__))
SCHEMA_FOLDER = os.path.join(SOURCE_FOLDER, '..', '..', 'schemas')
PULSE_SCHEMAS = load_schemas(SCHEMA_FOLDER)


class LazyPublisher():
    """
    Singleton for lazily connecting to the pulse publisher.
    """

    def __init__(self):
        self.publisher = None

    def get_publisher(self):
        """
        Attempt to get the publisher.
        """
        # Create publisher, if username and password is present
        if not self.publisher and settings.PULSE_EXCHANGE_NAMESPACE:
            self.publisher = TreeherderPublisher(
                namespace=settings.PULSE_EXCHANGE_NAMESPACE,
                uri=settings.PULSE_URI,
                schemas=PULSE_SCHEMAS
            )

        return self.publisher

pulse_connection = LazyPublisher()


# Run a maximum of 1 per hour
@task(name='cycle-data', rate_limit='1/h')
def cycle_data():
    call_command('cycle_data')


@task(name='calculate-durations', rate_limit='1/h')
def calculate_durations(sample_window_seconds=21600, debug=False):
    from treeherder.model.derived.jobs import JobsModel

    projects = Repository.objects.filter(active_status='active').values_list('name', flat=True)

    for project in projects:

        with JobsModel(project) as jm:
            jm.calculate_durations(sample_window_seconds, debug)


@task(name='publish-job-action')
def publish_job_action(project, action, job_id, requester):
    """
    Generic task to issue pulse notifications when jobs actions occur
    (retrigger/cancel)

    :param project str: The name of the project this action was requested for.
    :param action str: The type of action performed (retrigger/cancel/etc..)
    :param job_id str: The job id the action was requested for.
    :param requester str: The email address associated with the request.
    """
    job = Job.objects.get(id=job_id)

    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("action", action)
    newrelic.agent.add_custom_parameter("job_id", job.id)
    newrelic.agent.add_custom_parameter("requester", requester)
    publisher = pulse_connection.get_publisher()
    if not publisher:
        return

    publisher.job_action(
        version=1,
        build_system_type=job.signature.build_system_type,
        project=project,
        action=action,
        job_guid=job.guid,
        # Job id is included for convenience as you need it in some cases
        # instead of job_guid...
        job_id=job.id,
        requester=requester
    )


@task(name='publish-resultset-action')
def publish_resultset_action(project, action, resultset_id, requester, times=1):
    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("action", action)
    newrelic.agent.add_custom_parameter("resultset_id", resultset_id)
    newrelic.agent.add_custom_parameter("requester", requester)
    publisher = pulse_connection.get_publisher()
    if not publisher:
        return

    publisher.resultset_action(
        version=1,
        project=project,
        action=action,
        requester=requester,
        resultset_id=resultset_id,
        times=times
    )


@task(name='publish-resultset-runnable-job-action')
def publish_resultset_runnable_job_action(project, resultset_id, requester,
                                          requested_jobs, decision_task_id):
    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("resultset_id", resultset_id)
    newrelic.agent.add_custom_parameter("requester", requester)
    publisher = pulse_connection.get_publisher()
    if not publisher:
        return
    timestamp = str(time.time())
    publisher.resultset_runnable_job_action(
        version=1,
        project=project,
        requester=requester,
        resultset_id=resultset_id,
        requested_jobs=requested_jobs,
        decision_task_id=decision_task_id,
        timestamp=timestamp
    )
