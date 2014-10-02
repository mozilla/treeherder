"""
This module contains
"""
import urllib
from celery import task, group
from treeherder.model.derived import RefDataManager
from .buildapi import (RunningJobsProcess,
                       PendingJobsProcess,
                       Builds4hJobsProcess,
                       Builds4hAnalyzer)
from .bugzilla import BzApiBugProcess
from .tbpl import OrangeFactorBugRequest, TbplBugRequest, BugzillaBugRequest
from .pushlog import HgPushlogProcess, MissingHgPushlogProcess


@task(name='fetch-buildapi-pending', time_limit=3*60)
def fetch_buildapi_pending():
    """
    Fetches the buildapi pending jobs api and load them to
    the objectstore ingestion endpoint
    """
    PendingJobsProcess().run()


@task(name='fetch-buildapi-running', time_limit=3*60)
def fetch_buildapi_running():
    """
    Fetches the buildapi running jobs api and load them to
    the objectstore ingestion endpoint
    """
    RunningJobsProcess().run()


@task(name='fetch-buildapi-build4h', time_limit=3*60)
def fetch_buildapi_build4h():
    """
    Fetches the buildapi running jobs api and load them to
    the objectstore ingestion endpoint
    """
    Builds4hJobsProcess().run()


@task(name='fetch-push-logs')
def fetch_push_logs():
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    rdm = RefDataManager()
    try:
        repos = filter(lambda x: x['url'], rdm.get_all_repository_info())
        # create a group of subtasks and apply them
        g = group(fetch_hg_push_log.si(repo['name'], repo['url'])
                            for repo in repos if repo['dvcs_type'] == 'hg')
        g()
    finally:
        rdm.disconnect()


@task(name='fetch-hg-push-logs', time_limit=3*60)
def fetch_hg_push_log(repo_name, repo_url):
    """
    Run a HgPushlog etl process
    """
    process = HgPushlogProcess()
    process.run(repo_url + '/json-pushes/?full=1', repo_name)


@task(name='fetch-missing-push-logs')
def fetch_missing_push_logs(missing_pushlogs):
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    rdm = RefDataManager()
    try:
        repos = filter(lambda x: x['url'], rdm.get_all_repository_info())
        # create a group of subtasks and apply them
        g = group(fetch_missing_hg_push_logs.si(
            repo['name'],
            repo['url'],
            missing_pushlogs[repo['name']]
            )
            for repo in repos if repo['dvcs_type'] == 'hg' and repo['name'] in missing_pushlogs)
        g()
    finally:
        rdm.disconnect()


@task(name='fetch-missing-hg-push-logs', time_limit=3*60)
def fetch_missing_hg_push_logs(repo_name, repo_url, revisions):
    """
    Run a HgPushlog etl process

    ``revisions`` is a list of changeset values truncated to 12 chars.
    """
    process = MissingHgPushlogProcess()

    changesetParam = urllib.urlencode({"changeset", revisions})
    urlStr = repo_url + '/json-pushes/?full=1&' + changesetParam

    process.run(urlStr, repo_name)


@task(name='fetch-bugs', time_limit=10 * 60)
def fetch_bugs():
    """
    Run a BzApiBug process
    """
    process = BzApiBugProcess()
    process.run()


@task(name='run-builds4h-analyzer')
def run_builds4h_analyzer():
    """
    Run a Builds4h Analysis process
    """
    process = Builds4hAnalyzer()
    process.run()


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
