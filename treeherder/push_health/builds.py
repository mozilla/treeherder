from treeherder.model.models import Job
from treeherder.push_health.utils import mark_failed_in_parent, get_job_results


def get_build_failures(push, parent_push=None):
    build_results = Job.objects.filter(
        push=push,
        tier__lte=2,
    ).select_related('machine_platform', 'taskcluster_metadata')

    result, failures = get_job_results(build_results, 'busted')

    if parent_push:
        mark_failed_in_parent(failures, get_build_failures(parent_push)[1])

    return (result, failures)
