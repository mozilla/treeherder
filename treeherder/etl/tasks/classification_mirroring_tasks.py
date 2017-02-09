import newrelic.agent

from treeherder.etl.classification_mirroring import ElasticsearchDocRequest
from treeherder.workers.task import retryable_task


@retryable_task(name="submit-elasticsearch-doc", max_retries=10, soft_time_limit=30)
def submit_elasticsearch_doc(project, job_id, bug_id, classification_timestamp, who):
    """
    Mirror the classification to Elasticsearch using a post request, until
    OrangeFactor is rewritten to use Treeherder's API directly.
    """
    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("job_id", job_id)
    newrelic.agent.add_custom_parameter("bug_id", bug_id)
    req = ElasticsearchDocRequest(project, job_id, bug_id, classification_timestamp, who)
    req.generate_request_body()
    req.send_request()
