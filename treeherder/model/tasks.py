import newrelic.agent

from treeherder.model.models import Job
from treeherder.services.pulse import publish_job_action as pulse_publish_job_action
from treeherder.workers.task import retryable_task


# Only retrying up to 3 times, since it's likely the user will repeat the request, and we
# don't want multiple retriggers occurring N hours later due to the exponential back-off.
@retryable_task(name='publish-job-action', max_retries=3)
def publish_job_action(project, action, job_id, requester):
    """
    Generic task to issue pulse notifications when jobs actions occur
    (retrigger/cancel)

    :param project str: The name of the project this action was requested for.
    :param action str: The type of action performed (retrigger/cancel/etc..)
    :param job_id str: The job id the action was requested for.
    :param requester str: The email address associated with the request.
    """
    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("action", action)
    newrelic.agent.add_custom_parameter("job_id", str(job_id))
    newrelic.agent.add_custom_parameter("requester", requester)

    job = Job.objects.get(id=job_id)
    pulse_publish_job_action(
        version=1,
        build_system_type=job.signature.build_system_type,
        project=project,
        action=action,
        job_guid=job.guid,
        # Job id is included for convenience as you need it in some cases
        # instead of job_guid...
        job_id=job.id,
        requester=requester
    )
