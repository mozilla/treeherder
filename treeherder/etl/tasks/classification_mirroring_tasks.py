import newrelic.agent
from celery import task

from treeherder.etl.classification_mirroring import ElasticsearchDocRequest


@task(name="submit-elasticsearch-doc", max_retries=10, time_limit=30)
def submit_elasticsearch_doc(project, job_id, bug_id, classification_timestamp, who):
    """
    Mirror the classification to Elasticsearch using a post request, until
    OrangeFactor is rewritten to use Treeherder's API directly.
    """
    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("job_id", job_id)
    newrelic.agent.add_custom_parameter("bug_id", bug_id)
    try:
        req = ElasticsearchDocRequest(project, job_id, bug_id, classification_timestamp, who)
        req.generate_request_body()
        req.send_request()
    except Exception as e:
        # Initially retry after 1 minute, then for each subsequent retry
        # lengthen the retry time by another minute.
        submit_elasticsearch_doc.retry(exc=e, countdown=(1 + submit_elasticsearch_doc.request.retries) * 60)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise
