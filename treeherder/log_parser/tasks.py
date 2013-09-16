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

from treeherder.model.derived import JobsModel
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection


@task(name='parse-log')
def parse_log(project, job_id, check_errors=True):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    jm = JobsModel(project=project)
    log_references = jm.get_log_references(job_id)

    # we may have many log references per job
    for log in log_references:

        # parse a log given its url
        artifact_builder_collection = ArtifactBuilderCollection(
            log['url'],
            check_errors,
        )
        artifact_builder_collection.parse()

        # store the artifacts generated
        for name, artifact in artifact_builder_collection.artifacts.items():
            jm.insert_job_artifact(job_id, name, 'json', json.dumps(artifact))
    jm.disconnect()
