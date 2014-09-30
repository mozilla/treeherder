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

@task(name='publish-to-pulse')
def publish_to_pulse(project, ids, data_type):

    jm = JobsModel(project)

    # Get appropriate data for data_type
    # using the ids provided
    data = []
    if data_type == 'result_set':
        data = jm.get_result_set_list_by_ids(ids)

    jm.disconnect()

    # TODO: publish the data to pulse



