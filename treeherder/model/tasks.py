from celery import task
from django.conf import settings

from treeherder.model.derived import JobsModel
from treeherder.model.models import Datasource, Repository

@task(name='process-objects')
def process_objects(limit=None):
    """
    Process a number of objects from the objectstore
    and load them to the jobs store
    """
    # default limit to 100
    limit = limit or 100
    for ds in Datasource.objects.all():
        jm = JobsModel(ds.project)
        try:
            jm.process_objects(limit)
        finally:
            jm.disconnect()

# Run a maximum of 1 per hour
@task(name='cycle-data', rate_limit='1/h')
def cycle_data(max_iterations=50, debug=False):

    projects = Repository.objects.all().values_list('name', flat=True)

    for project in projects:

        jm = JobsModel(project)

        sql_targets = {}

        if debug:
            print "Cycling Database: {0}".format(project)

        cycle_iterations = max_iterations

        while cycle_iterations > 0:

            sql_targets = jm.cycle_data(sql_targets)

            if debug:
                print "Iterations: {0}".format(str(cycle_iterations))
                print "sql_targets"
                print sql_targets

            cycle_iterations -= 1

            # No more items to delete
            if sql_targets['total_count'] == 0:
                cycle_iterations = 0

        jm.disconnect()

@task(name='calculate-eta', rate_limit='1/h')
def calculate_eta(sample_window_seconds=21600, debug=False):

    projects = Repository.objects.all().values_list('name', flat=True)

    for project in projects:

        jm = JobsModel(project)

        jm.calculate_eta(sample_window_seconds, debug)

        jm.disconnect()

@task(name='populate-performance-series')
def populate_performance_series(project, series_type, series_data):

    jm = JobsModel(project)
    for t_range in settings.TREEHERDER_PERF_SERIES_TIME_RANGES:
        for signature in series_data:
            jm.store_performance_series(
                t_range['seconds'], series_type, signature,
                series_data[signature]
            )
    jm.disconnect()

from treeherder.model.exchanges import TreeherderPublisher
from treeherder.model.pulse_publisher import load_schemas
import os

# Load schemas for validation of messages published on pulse
source_folder = os.path.dirname(os.path.realpath(__file__))
schema_folder = os.path.join(source_folder, '..', '..', 'schemas')
schemas = load_schemas(schema_folder)

# Create publisher, if username and password is present
publisher = None
if settings.PULSE_USERNAME and settings.PULSE_PASSWORD:
    publisher = TreeherderPublisher(
        client_id       = settings.PULSE_USERNAME,
        access_token    = settings.PULSE_PASSWORD,
        schemas         = schemas
    )

@task(name='publish-to-pulse')
def publish_to_pulse(project, ids, data_type):
    # If we don't have a publisher (because of missing configs), then we can't
    # publish any pulse messages. This is okay, local installs etc. doesn't
    # need to publish on pulse, and requiring a pulse user is adding more
    # overhead to an already large development setup process.
    if not publisher:
        return

    jm = JobsModel(project)

    try:
        # Publish messages with new result-sets
        if data_type == 'result_set':
            # Get appropriate data for data_type
            # using the ids provided
            for entry in jm.get_result_set_list_by_ids(ids):
                # Don't expose these properties, they are internal, at least that's
                # what I think without documentation I have no clue... what any of
                # this is
                del entry['revisions']      # Not really internal, but too big
                del entry['repository_id']

                # Set required properties
                entry['version'] = 1
                entry['project'] = project
                # Property revision_hash should already be there, I suspect it is the
                # result-set identifier...

                # publish the data to pulse
                publisher.new_result_set(
                    message         = entry,
                    revision_hash   = entry['revision_hash'],
                    project         = project
                )

            # Basically, I have no idea what context this runs and was inherently
            # unable to make kombu with or without pyamqp, etc. confirm-publish,
            # so we're stuck with this super ugly hack where we just close the
            # connection so that if the process context is destroyed then at least
            # messages will still get published... Well, assuming nothing goes
            # wrong, because we're not using confirm channels for publishing...
            publisher.connection.release()
    finally:
        jm.disconnect()
