
import time
from hashlib import md5
from celery import task
from django.conf import settings
from django.core.cache import cache

from thclient import TreeherderArtifactCollection, TreeherderRequest


from treeherder.log_parser.utils import (get_error_search_term,
                                         get_crash_signature,
                                         get_bugs_for_search_term,
                                         get_mozharness_substring,
                                         extract_log_artifacts)

from treeherder.etl.oauth_utils import OAuthCredentials

LOCK_EXPIRE = 60 * 5


@task(name='parse-log', max_retries=10)
def parse_log(project, job_log_url, job_guid, check_errors=False):
    """
    Call ArtifactBuilderCollection on the given job.
    """

    hash_obj = md5()
    hash_obj.update(project)
    hash_obj.update(str(job_log_url['id']))
    if check_errors:
        hash_obj.update("failures")
    lock_id = hash_obj.hexdigest()

    acquire_lock = lambda: cache.add(lock_id, 'true', LOCK_EXPIRE)
    release_lock = lambda: cache.delete(lock_id)

    if acquire_lock():
        try:
            credentials = OAuthCredentials.get_credentials(project)
            req = TreeherderRequest(
                protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
                host=settings.TREEHERDER_REQUEST_HOST,
                project=project,
                oauth_key=credentials.get('consumer_key', None),
                oauth_secret=credentials.get('consumer_secret', None),
            )
            update_endpoint = 'job-log-url/{0}/update_parse_status'.format(
                job_log_url['id']
            )

            artifact_list = extract_log_artifacts(job_log_url['url'],
                                                  job_guid, check_errors)
            # store the artifacts generated
            tac = TreeherderArtifactCollection()
            for artifact in artifact_list:
                ta = tac.get_artifact({
                    "job_guid": artifact[0],
                    "name": artifact[1],
                    "type": artifact[2],
                    "blob": artifact[3]
                })
                tac.add(ta)

            req.post(tac)

            # send an update to job_log_url
            # the job_log_url status changes from pending to parsed
            current_timestamp = time.time()
            req.send(
                update_endpoint,
                method='POST',
                data={
                    'parse_status': 'parsed',
                    'parse_timestamp': current_timestamp
                }
            )
        except Exception, e:
            # send an update to job_log_url
            #the job_log_url status changes from pending/running to failed
            current_timestamp = time.time()
            req.send(
                update_endpoint,
                method='POST',
                data={
                    'parse_status': 'failed',
                    'parse_timestamp': current_timestamp
                }
            )
            # for every retry, set the countdown to 10 minutes
            # .retry() raises a RetryTaskError exception,
            # so nothing below this line will be executed.
            parse_log.retry(exc=e, countdown=10*60)
        finally:
            release_lock()
