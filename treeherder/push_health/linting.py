from treeherder.model.models import Job
from treeherder.push_health.similar_jobs import job_to_dict
from treeherder.push_health.utils import mark_failed_in_parent


def get_lint_failures(push, parent_push=None):
    lint_failures = Job.objects.filter(
        push=push,
        tier__lte=2,
        result='testfailed',
        machine_platform__platform='lint'
    ).select_related('machine_platform', 'taskcluster_metadata')

    failures = [job_to_dict(job) for job in lint_failures]

    if parent_push:
        mark_failed_in_parent(failures, get_lint_failures(parent_push))

    return failures
