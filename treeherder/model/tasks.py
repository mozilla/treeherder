from celery import task
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

@task(name='cycle-data', rate_limit='24/h')
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
