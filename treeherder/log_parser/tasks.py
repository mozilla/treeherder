"""
We should have only celery tasks in this module.
To know how to call one of these tasks, see
http://docs.celeryproject.org/en/latest/userguide/calling.html#guide-calling
If you want to obtain some cool executions flows (e.g. mapreduce)
have a look at the canvas section in the docs
http://docs.celeryproject.org/en/latest/userguide/canvas.html#guide-canvas
"""
import simplejson as json
import re
import time
import traceback, sys

from celery import task
from django.conf import settings
from django.core.urlresolvers import reverse

from thclient import TreeherderArtifactCollection, TreeherderRequest

from treeherder.log_parser.artifactbuildercollection import \
    ArtifactBuilderCollection
from treeherder.log_parser.utils import (get_error_search_term,
                                         get_crash_signature,
                                         get_bugs_for_search_term)

from treeherder.etl.oauth_utils import OAuthCredentials


@task(name='parse-log', max_retries=3)
def parse_log(project, job_log_url, job_guid, check_errors=False):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    credentials = OAuthCredentials.get_credentials(project)
    req = TreeherderRequest(
        protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
        host=settings.TREEHERDER_REQUEST_HOST,
        project=project,
        oauth_key=credentials.get('consumer_key', None),
        oauth_secret=credentials.get('consumer_secret', None),
    )
    update_endpoint = 'job-log-url/{0}/update_parse_status'.format(job_log_url['id'])

    try:
        log_url = job_log_url['url']
        mozharness_pattern = re.compile(
            '^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?'
        )

        bugs_cache = {'open': {}, 'closed': {}}
        bug_suggestions = {'open': [], 'closed': []}


        # return the resultset with the job id to identify if the UI wants
        # to fetch the whole thing.

        bugscache_uri = '{0}{1}'.format(
            settings.API_HOSTNAME,
            reverse("bugscache-list")
        )

        if log_url:
            # parse a log given its url
            artifact_bc = ArtifactBuilderCollection(
                log_url,
                check_errors=check_errors,
            )
            artifact_bc.parse()

            artifact_list = []
            for name, artifact in artifact_bc.artifacts.items():
                artifact_list.append((job_guid, name, 'json', json.dumps(artifact)))

            if check_errors:
                all_errors = artifact_bc.artifacts.get(
                    'Structured Log', {}
                    ).get(
                        'step_data', {}
                        ).get(
                            'all_errors', [] )

                for err in all_errors:
                    # remove the mozharness prefix
                    clean_line = mozharness_pattern.sub('', err['line']).strip()
                    # get a meaningful search term out of the error line
                    search_term = get_error_search_term(clean_line)
                    # collect open and closed bugs suggestions
                    for status in ('open', 'closed'):
                        if not search_term:
                            bug_suggestions[status].append([])
                            continue
                        if search_term not in bugs_cache[status]:
                            # retrieve the list of suggestions from the api
                            # bugs_cache[status][search_term] = get_bugs_for_search_term(
                            #     search_term,
                            #     status,
                            #     bugscache_uri
                            # )
                            bugs_cache[status][search_term] = {
                                "Preparing to abort run due to failed verify check.": [],
                                "Dying due to failing verification": [],
                                "Return code: 1": [],
                                "Exiting -1": [],
                                "Remote Device Error: Unhandled exception in cleanupDevice": [],
                                "Running post_fatal callback...": [],
                                "Caught Exception: Remote Device Error: unable to connect to panda-0415 after 5 attempts": []
                            }


                            # no suggestions, try to use the crash signature as search term
                            if not bugs_cache[status][search_term]:
                                crash_signature = get_crash_signature(search_term)
                                if crash_signature:
                                    bugs_cache[status][search_term] = get_bugs_for_search_term(
                                        search_term,
                                        status,
                                        bugscache_uri
                                    )

                        bug_suggestions[status].append({
                            "search": clean_line,
                            "bugs": bugs_cache[status][search_term]
                        })

            artifact_list.append((job_guid, 'Open bugs', 'json', json.dumps(bug_suggestions['open'])))
            artifact_list.append((job_guid, 'Closed bugs', 'json', json.dumps(bug_suggestions['closed'])))

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
            # the job_log_url status changes
            # from pending to running
            current_timestamp = time.time()
            status = 'parsed'
            req.send(
                update_endpoint,
                method='POST',
                data={
                    'parse_status': status,
                    'parse_timestamp': current_timestamp
                }
            )

    except Exception, e:
        traceback.print_exc(file=sys.stdout)
        print e
        parse_log.retry(exc=e)
        # send an update to job_log_url
        # the job_log_url status changes
        # from pending to running
        current_timestamp = time.time()
        status = 'failed'
        req.send(
            update_endpoint,
            method='POST',
            data={
                'parse_status': status,
                'parse_timestamp': current_timestamp
            }
        )
        # re raise the exception to leave a trace in the log
        raise
