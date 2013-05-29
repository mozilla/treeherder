import celery
from treeherder.etl.buildapi import TreeherderBuildapiAdapter


@celery.task(name='fetch-pending-jobs')
def fetch_pending_jobs():
    adpter = TreeherderBuildapiAdapter()
    adapter.process_pending_jobs()

# @celery.task(name='fetch-running-jobs')
# def fetch_running_jobs():
#     consumer = BuildApiConsumer()
#     consumer.fetch_running_jobs()
