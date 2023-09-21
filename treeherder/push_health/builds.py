from treeherder.model.models import Job, JobType
from treeherder.push_health.utils import get_job_results
from django.db.models import Q


def get_build_failures(push):
    build_types = JobType.objects.filter(Q(name__icontains=="build"))

    build_results = Job.objects.filter(
        push=push,
        tier__lte=2,
        job_type__in=build_types,
    ).select_related("machine_platform", "taskcluster_metadata")

    result, failures, in_progress_count = get_job_results(build_results, "busted")

    return (result, failures, in_progress_count)
