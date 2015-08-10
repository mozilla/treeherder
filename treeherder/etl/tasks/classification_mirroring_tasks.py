from celery import task

from treeherder.etl.classification_mirroring import BugzillaCommentRequest, ElasticsearchDocRequest


@task(name="submit-elasticsearch-doc", max_retries=10, time_limit=30)
def submit_elasticsearch_doc(project, job_id, bug_id, classification_timestamp, who):
    """
    Mirror the classification to Elasticsearch using a post request, until
    OrangeFactor is rewritten to use Treeherder's API directly.
    """
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


@task(name="submit-bugzilla-comment", max_retries=10, time_limit=30)
def submit_bugzilla_comment(project, job_id, bug_id, who):
    """
    Send a post request to Bugzilla's REST API to add a new comment to the associated bug.
    In the future this will be removed in favour of periodic (eg once a week) summary comments
    on intermittent failure bugs, made by OrangeFactor v2 or similar.
    """
    try:
        req = BugzillaCommentRequest(project, job_id, bug_id, who)
        req.generate_request_body()
        req.send_request()
    except Exception as e:
        # Initially retry after 1 minute, then for each subsequent retry
        # lengthen the retry time by another minute.
        submit_bugzilla_comment.retry(exc=e, countdown=(1 + submit_bugzilla_comment.request.retries) * 60)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise
