"""
This module contains
"""
from celery import task, group
from treeherder.etl.tbpl import OrangeFactorBugRequest, TbplBugRequest, BugzillaBugRequest


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
    except Exception, e:
        submit_star_comment.retry(exc=e)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise


@task(name="submit-build-star", max_retries=10, time_limit=30)
def submit_build_star(project, job_id, who, bug_id=None, classification_id=None, note=None):
    """
    Send a post request to tbpl's submitBuildStar.php to mirror sheriff's activity
    from treeherder to tbpl. It can be used for both bug association and classification
    """
    try:
        req = TbplBugRequest(project, job_id, who, bug_id=bug_id, classification_id=classification_id, note=note)
        req.generate_request_body()
        req.send_request()
    except Exception, e:
        submit_build_star.retry(exc=e)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise


@task(name="submit-bug-comment", max_retries=10, time_limit=30)
def submit_bug_comment(project, job_id, bug_id):
    """
    Send a post request to tbpl's submitBugzillaComment.php
    to add a new comment to the associated bug on bugzilla.
    """
    try:
        req = BugzillaBugRequest(project, job_id, bug_id)
        req.generate_request_body()
        req.send_request()
    except Exception, e:
        submit_bug_comment.retry(exc=e)
        # this exception will be raised once the number of retries
        # exceeds max_retries
        raise
