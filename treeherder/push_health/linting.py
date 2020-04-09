from django.db.models import Q

from treeherder.model.models import Job
from treeherder.push_health.utils import get_job_results


def get_lint_failures(push):
    lint_results = Job.objects.filter(
        Q(machine_platform__platform='lint') | Q(job_type__symbol='mozlint'),
        push=push,
        tier__lte=2,
    ).select_related('machine_platform', 'taskcluster_metadata', 'job_type', 'job_group')

    result, failures, in_progress_count = get_job_results(lint_results, 'testfailed')

    return (result, failures, in_progress_count)
