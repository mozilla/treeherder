# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from celery import task
from treeherder.etl.classification_mirroring import ElasticsearchDocRequest, BugzillaCommentRequest


@task(name="submit-star-comment", max_retries=10, time_limit=30)
def submit_star_comment(project, job_id, bug_id, submit_timestamp, who):
    """
    Mirror the classification to Elasticsearch using a post request, until
    OrangeFactor is rewritten to use Treeherder's API directly.
    """
    try:
        req = ElasticsearchDocRequest(project, job_id, bug_id, submit_timestamp, who)
        req.generate_request_body()
        req.send_request()
    except Exception as e:
        # Initially retry after 1 minute, then for each subsequent retry
        # lengthen the retry time by another minute.
        submit_star_comment.retry(exc=e, countdown=(1 + submit_star_comment.request.retries) * 60)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise


@task(name="submit-bug-comment", max_retries=10, time_limit=30)
def submit_bug_comment(project, job_id, bug_id, who):
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
        submit_bug_comment.retry(exc=e, countdown=(1 + submit_bug_comment.request.retries) * 60)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise
