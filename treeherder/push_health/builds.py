from treeherder.model.models import Job, JobType
from treeherder.push_health.utils import mark_failed_in_parent, get_job_results
from django.db.models import Q


def get_build_failures(push, parent_push=None):
    # icontains doesn't work with mysql unless collation settings are adjusted: https://code.djangoproject.com/ticket/9682
    build_types = JobType.objects.filter(Q(name__contains='Build') | Q(name__contains='build'))

    build_results = Job.objects.filter(
        push=push,
        tier__lte=2,
        job_type__in=build_types,
    ).select_related('machine_platform', 'taskcluster_metadata')

    result, failures = get_job_results(build_results, 'busted')

    if parent_push:
        mark_failed_in_parent(failures, get_build_failures(parent_push)[1])

    return (result, failures)


def get_build_in_progress_count(push):
    build_types = JobType.objects.filter(name__contains="build")
    return Job.objects.filter(
        push=push,
        tier__lte=2,
        result='unknown',
        job_type__in=build_types,
    ).count()
