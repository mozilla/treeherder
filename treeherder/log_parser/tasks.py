"""
We should have only celery tasks in this module.
To know how to call one of these tasks, see
http://docs.celeryproject.org/en/latest/userguide/calling.html#guide-calling
If you want to obtain some cool executions flows (e.g. mapreduce)
have a look at the canvas section in the docs
http://docs.celeryproject.org/en/latest/userguide/canvas.html#guide-canvas
"""
import simplejson as json

from celery import task

from treeherder.model.derived import JobsModel, RefDataManager
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection


@task(name='parse-log')
def parse_log(project, job_id, check_errors=True):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    jm = JobsModel(project=project)
    rdm = RefDataManager()

    try:
        log_references = jm.get_log_references(job_id)

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
                error_lines = [err['line'] for err in all_errors]
                open_bugs_suggestions = []
                closed_bugs_suggestions = []
                for line in error_lines:
                    open_bugs_suggestions += rdm.get_suggested_bugs(line)
                    closed_bugs_suggestions += rdm.get_suggested_bugs(line, open_bugs=False)

                artifact_list.append((job_id, 'Open bugs', 'json', json.dumps(open_bugs_suggestions)))
                artifact_list.append((job_id, 'Closed bugs', 'json', json.dumps(closed_bugs_suggestions)))

            # store the artifacts generated
            jm.store_job_artifact(artifact_list)
    finally:
        rdm.disconnect()
        jm.disconnect()
