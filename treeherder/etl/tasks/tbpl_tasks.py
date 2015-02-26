# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

"""
This module contains
"""
from celery import task
from treeherder.etl.tbpl import OrangeFactorBugRequest, BugzillaBugRequest


@task(name="submit-star-comment", max_retries=10, time_limit=30)
def submit_star_comment(project, job_id, bug_id, submit_timestamp, who):
    """
    Send a post request to tbpl's starcomment.php containing a bug association.
    starcomment.php proxies then the request to orange factor
    """
    try:
        req = OrangeFactorBugRequest(project, job_id, bug_id, submit_timestamp, who)
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
    Send a post request to tbpl's submitBugzillaComment.php
    to add a new comment to the associated bug on bugzilla.
    """
    try:
        req = BugzillaBugRequest(project, job_id, bug_id, who)
        req.generate_request_body()
        req.send_request()
    except Exception as e:
        # Initially retry after 1 minute, then for each subsequent retry
        # lengthen the retry time by another minute.
        submit_bug_comment.retry(exc=e, countdown=(1 + submit_bug_comment.request.retries) * 60)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise
