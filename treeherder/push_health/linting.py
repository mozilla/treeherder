from django.db.models import Q

from treeherder.model.models import Job
from treeherder.push_health.utils import mark_failed_in_parent, get_job_results


def get_lint_failures(push, parent_push=None):
    lint_results = Job.objects.filter(
        Q(machine_platform__platform='lint') | Q(job_type__symbol='mozlint'),
        push=push,
        tier__lte=2,
    ).select_related('machine_platform', 'taskcluster_metadata')

    result, failures = get_job_results(lint_results, 'testfailed')

    if parent_push:
        mark_failed_in_parent(failures, get_lint_failures(parent_push)[1])

    return (result, failures)
