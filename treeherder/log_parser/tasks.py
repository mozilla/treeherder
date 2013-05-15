"""
We should have only celery tasks in this module.
To know how to call one of these tasks, see
http://docs.celeryproject.org/en/latest/userguide/calling.html#guide-calling
If you want to obtain some cool executions flows (e.g. mapreduce)
have a look at the canvas section in the docs
http://docs.celeryproject.org/en/latest/userguide/canvas.html#guide-canvas
"""

from celery import task


@task()
def parse_log(project, job_id):
    """
    Calls LogParseManager on the given job.
    """
    # TODO: fill the body of this function once LogParseManager
    # interface is stable
