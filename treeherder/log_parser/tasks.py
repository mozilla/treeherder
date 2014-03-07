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

from celery import task
from django.conf import settings
from django.core.urlresolvers import reverse

from treeherder.model.derived import JobsModel, RefDataManager
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.events.publisher import JobFailurePublisher, JobStatusPublisher
from treeherder.etl.common import get_remote_content
import urllib


@task(name='parse-log')
def parse_log(project, job_id, result_set_id, check_errors=False):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    pattern_obj = re.compile('\d+:\d+:\d+\s+')

    jm = JobsModel(project=project)
    rdm = RefDataManager()

    open_bugs_cache = {}
    closed_bugs_cache = {}

    status_publisher = JobStatusPublisher(settings.BROKER_URL)
    failure_publisher = JobFailurePublisher(settings.BROKER_URL)

    try:
        # return the resultset with the job id to identify if the UI wants
        # to fetch the whole thing.
        resultset = jm.get_result_set_by_id(result_set_id=result_set_id)[0]
        del(resultset["active_status"])
        del(resultset["revision_hash"])

        log_references = jm.get_log_references(job_id)
        artifact_uri = reverse("bugscache-list")

        # we may have many log references per job
        for log in log_references:

            # parse a log given its url
            artifact_bc = ArtifactBuilderCollection(
                log['url'],
                check_errors=check_errors,
            )
            artifact_bc.parse()

            artifact_list = []
            for name, artifact in artifact_bc.artifacts.items():
                artifact_list.append((job_id, name, 'json', json.dumps(artifact)))

            if check_errors:
                # I'll try to begin with a full_text search on the entire row

                all_errors = artifact_bc.artifacts['Structured Log']['step_data']['all_errors']

                open_bugs_suggestions = {}
                closed_bugs_suggestions = {}

                for err in all_errors:

                    # remove timestamp
                    clean_line = pattern_obj.sub('', err['line'])

                    if clean_line not in open_bugs_cache:
                        query_params = urllib.urlencode({
                            "search": clean_line,
                            "status": 'open'
                        })

                        open_bugs_cache[clean_line] = get_remote_content(
                            "{0}?{1}".format(artifact_uri, query_params)
                        )

                    if clean_line not in closed_bugs_cache:
                        query_params = urllib.urlencode({
                            "search": clean_line,
                            "status": 'closed'
                        })
                        closed_bugs_cache[clean_line] = get_remote_content(
                            "{0}?{1}".format(artifact_uri, query_params)
                        )

                    open_bugs_suggestions[ err['line'] ] = open_bugs_cache[clean_line]
                    closed_bugs_suggestions[ err['line'] ] = closed_bugs_cache[clean_line]

                artifact_list.append((job_id, 'Open bugs', 'json', json.dumps(open_bugs_suggestions)))
                artifact_list.append((job_id, 'Closed bugs', 'json', json.dumps(closed_bugs_suggestions)))

            # store the artifacts generated
            jm.store_job_artifact(artifact_list)
        status_publisher.publish(job_id, resultset, project, 'processed')
        if check_errors:
            failure_publisher.publish(job_id, project)

    finally:
        rdm.disconnect()
        jm.disconnect()
        status_publisher.disconnect()
        failure_publisher.disconnect()
