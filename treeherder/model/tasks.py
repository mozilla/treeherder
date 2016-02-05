import os

from celery import task
from django.conf import settings
from django.core.management import call_command

from treeherder.model.error_summary import load_error_summary
from treeherder.model.exchanges import TreeherderPublisher
from treeherder.model.models import Repository
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
@task(name='cycle-data', rate_limit='1/h', ignore_result=True)
def cycle_data():
    call_command('cycle_data')


@task(name='calculate-durations', rate_limit='1/h', ignore_result=True)
def calculate_durations(sample_window_seconds=21600, debug=False):
    from treeherder.model.derived.jobs import JobsModel

    projects = Repository.objects.filter(active_status='active').values_list('name', flat=True)

    for project in projects:

        with JobsModel(project) as jm:
            jm.calculate_durations(sample_window_seconds, debug)


@task(name='publish-job-action', ignore_result=True)
def publish_job_action(project, action, job_id, requester):
    """
    Generic task to issue pulse notifications when jobs actions occur
    (retrigger/cancel)

    :param project str: The name of the project this action was requested for.
    :param action str: The type of action performed (retrigger/cancel/etc..)
    :param job_id str: The job id the action was requested for.
    :param requester str: The email address associated with the request.
    """
    publisher = pulse_connection.get_publisher()
    if not publisher:
        return

    from treeherder.model.derived.jobs import JobsModel

    with JobsModel(project) as jm:
        job = jm.get_job(job_id)[0]
        refdata = jm.get_job_reference_data(job['signature'])

        publisher.job_action(
            version=1,
            build_system_type=refdata['build_system_type'],
            project=project,
            action=action,
            job_guid=job['job_guid'],
            # Job id is included for convenience as you need it in some cases
            # instead of job_guid...
            job_id=job['id'],
            requester=requester
        )


@task(name='publish-resultset-action', ignore_result=True)
def publish_resultset_action(project, action, resultset_id, requester, times=1):
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
                                          buildernames):
    publisher = pulse_connection.get_publisher()
    if not publisher:
        return

    publisher.resultset_runnable_job_action(
        version=1,
        project=project,
        requester=requester,
        resultset_id=resultset_id,
        buildernames=buildernames
    )



@task(name='populate-error-summary')
def populate_error_summary(project, artifacts, job_id_lookup):
    """
    Create bug suggestions artifact(s) for any text_log_summary artifacts.

    ``artifacts`` here is a list of one or more ``text_log_summary`` artifacts.
    If any of them have ``error_lines``, then we generate the
    ``bug suggestions`` artifact from them.
    """

    load_error_summary(project, artifacts, job_id_lookup)
