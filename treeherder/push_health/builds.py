from treeherder.model.models import Job, JobType
from treeherder.push_health.utils import get_job_results
from django.db.models import Q


def get_build_failures(push):
    # icontains doesn't work with mysql unless collation settings are adjusted: https://code.djangoproject.com/ticket/9682
    build_types = JobType.objects.filter(Q(name__contains='Build') | Q(name__contains='build'))

    build_results = Job.objects.filter(
        push=push,
        tier__lte=2,
        job_type__in=build_types,
    ).select_related('machine_platform', 'taskcluster_metadata', 'job_type', 'job_group')

    result, failures, in_progress_count = get_job_results(build_results, 'busted')

    return (result, failures, in_progress_count)
