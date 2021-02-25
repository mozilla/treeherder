from treeherder.model.models import Job
from treeherder.push_health.utils import get_job_results


def get_build_failures(push, likely_build_regression_labels):
    build_results = Job.objects.filter(
        push=push,
        tier__lte=2,
        job_type__name__in=likely_build_regression_labels,
    ).select_related('machine_platform', 'taskcluster_metadata', 'job_type', 'job_group')

    result, failures, in_progress_count = get_job_results(build_results, 'busted')

    return (result, failures, in_progress_count)
