from treeherder.model.models import Job
from treeherder.push_health.utils import get_job_results


def get_build_failures(push):
    # Filter jobs directly by job_type__name instead of fetching JobType objects first.
    # This is more efficient because it only queries jobs for the specific push,
    # and the JobType filter happens on the join with an already-filtered dataset
    # (jobs in this push), rather than scanning the entire JobType table first.
    build_results = Job.objects.filter(
        push=push,
        tier__lte=2,
        job_type__name__icontains="build",
    ).select_related("machine_platform", "taskcluster_metadata", "job_type")

    result, failures, in_progress_count = get_job_results(build_results, "busted")

    return (result, failures, in_progress_count)
