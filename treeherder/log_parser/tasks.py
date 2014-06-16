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
import urllib

from celery import task
from django.conf import settings
from django.core.urlresolvers import reverse

from thclient import TreeherderArtifactCollection, TreeherderRequest

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.utils import (get_error_search_term,
                                         get_crash_signature, get_bugs_for_search_term)
from treeherder.events.publisher import JobFailurePublisher, JobStatusPublisher

from treeherder.etl.oauth_utils import OAuthCredentials


@task(name='parse-log')
def parse_log(project, log_url, job_guid, resultset, check_errors=False):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    mozharness_pattern = re.compile(
        '^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?'
    )

    bugs_cache = {'open': {}, 'closed': {}}
    bug_suggestions = {'open': {}, 'closed': {}}

    status_publisher = JobStatusPublisher(settings.BROKER_URL)
    failure_publisher = JobFailurePublisher(settings.BROKER_URL)

    try:
        # return the resultset with the job id to identify if the UI wants
        # to fetch the whole thing.

        bugscache_uri = '{0}{1}'.format(
            settings.API_HOSTNAME,
            reverse("bugscache-list")
        )

        credentials = OAuthCredentials.get_credentials(project)

        if log_url:
            # parse a log given its url
            artifact_bc = ArtifactBuilderCollection(
                log_url,
                check_errors=check_errors,
            )
            artifact_bc.parse()

            artifact_list = []
            for name, artifact in artifact_bc.artifacts.items():
                data_type = 'performance' if name == 'talos_data' else 'json'

                artifact_list.append((job_guid, name, data_type, json.dumps(artifact)))

            if check_errors:
                all_errors = artifact_bc.artifacts['Structured Log']['step_data']['all_errors']
                for err in all_errors:
                    # remove the mozharness prefix
                    clean_line = mozharness_pattern.sub('', err['line']).strip()
                    # get a meaningful search term out of the error line
                    search_term = get_error_search_term(clean_line)
                    # collect open and closed bugs suggestions
                    for status in ('open', 'closed'):
                        if not search_term:
                            bug_suggestions[status][clean_line] = []
                            continue
                        if search_term not in bugs_cache[status]:
                            # retrieve the list of suggestions from the api
                            bugs_cache[status][search_term] = get_bugs_for_search_term(
                                search_term,
                                status,
                                bugscache_uri
                            )
                            # no suggestions, try to use the crash signature as search term
                            if not bugs_cache[status][search_term]:
                                crash_signature = get_crash_signature(search_term)
                                if crash_signature:
                                    bugs_cache[status][search_term] = get_bugs_for_search_term(
                                        search_term,
                                        status,
                                        bugscache_uri
                                    )
                        bug_suggestions[status][clean_line] = bugs_cache[status][search_term]

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
            req = TreeherderRequest(
                protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
                host=settings.TREEHERDER_REQUEST_HOST,
                project=project,
                oauth_key=credentials.get('consumer_key', None),
                oauth_secret=credentials.get('consumer_secret', None),
            )
            req.send(tac)

        status_publisher.publish(job_guid, resultset, project, 'processed')
        if check_errors:
            failure_publisher.publish(job_guid, project)

    finally:
        status_publisher.disconnect()
        failure_publisher.disconnect()
