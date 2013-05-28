import celery
from treeherder.buildapi_consumer import BuildApiConsumer


@celery.task(name='fetch-pending-jobs')
def fetch_pending_jobs():
    consumer = BuildApiConsumer()
    consumer.fetch_pending_jobs()


@celery.task(name='fetch-running-jobs')
def fetch_running_jobs():
    consumer = BuildApiConsumer()
    consumer.fetch_running_jobs()