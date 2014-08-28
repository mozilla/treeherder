"""
We should have only celery tasks in this module.
To know how to call one of these tasks, see
http://docs.celeryproject.org/en/latest/userguide/calling.html#guide-calling
If you want to obtain some cool executions flows (e.g. mapreduce)
have a look at the canvas section in the docs
http://docs.celeryproject.org/en/latest/userguide/canvas.html#guide-canvas
"""
import simplejson as json
import time

from celery import task
from django.conf import settings
from django.core.urlresolvers import reverse

from thclient import TreeherderArtifactCollection, TreeherderRequest

from treeherder.log_parser.artifactbuildercollection import \
    ArtifactBuilderCollection
from treeherder.log_parser.utils import (get_error_search_term,
                                         get_crash_signature,
                                         get_bugs_for_search_term,
                                         get_mozharness_substring)

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
        bug_suggestions = []
        bugscache_uri = '{0}{1}'.format(
            settings.API_HOSTNAME,
            reverse("bugscache-list")
        )
        terms_requested = {}

        if log_url:
            # parse a log given its url
            artifact_bc = ArtifactBuilderCollection(log_url,
                                                    check_errors=check_errors)
            artifact_bc.parse()

            artifact_list = []
            for name, artifact in artifact_bc.artifacts.items():
                artifact_list.append((job_guid, name, 'json',
                                      json.dumps(artifact)))
            if check_errors:
                all_errors = artifact_bc.artifacts.get(
                    'Structured Log', {}
                    ).get(
                        'step_data', {}
                        ).get(
                            'all_errors', [] )

                for err in all_errors:
                    # remove the mozharness prefix
                    clean_line = get_mozharness_substring(err['line'])
                    # get a meaningful search term out of the error line
                    search_term = get_error_search_term(clean_line)
                    bugs = dict(open_recent=[], all_others=[])

                    # collect open recent and all other bugs suggestions
                    if search_term:
                        if not search_term in terms_requested:
                            # retrieve the list of suggestions from the api
                            bugs = get_bugs_for_search_term(
                                search_term,
                                bugscache_uri
                            )
                            terms_requested[search_term] = bugs
                        else:
                            bugs = terms_requested[search_term]

                    if not bugs or not (bugs['open_recent']
                                        or bugs['all_others']):
                        # no suggestions, try to use
                        # the crash signature as search term
                        crash_signature = get_crash_signature(clean_line)
                        if crash_signature:
                            if not crash_signature in terms_requested:
                                bugs = get_bugs_for_search_term(
                                    crash_signature,
                                    bugscache_uri
                                )
                                terms_requested[crash_signature] = bugs
                            else:
                                bugs = terms_requested[crash_signature]

                    bug_suggestions.append({
                        "search": clean_line,
                        "bugs": bugs
                    })

            artifact_list.append((job_guid, 'Bug suggestions', 'json', json.dumps(bug_suggestions)))

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
