from celery import task
from treeherder.model.derived import JobsModel
from treeherder.model.models import Datasource


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
