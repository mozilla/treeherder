from django.db.models import Q

from treeherder.model.models import Job
from treeherder.push_health.utils import get_job_results


def get_lint_failures(push):
    lint_results = Job.objects.filter(
        Q(machine_platform__platform="lint") | Q(job_type__symbol="mozlint"),
        push=push,
        tier__lte=2,
    ).select_related("machine_platform", "taskcluster_metadata", "job_type")

    result, failures, in_progress_count = get_job_results(lint_results, "testfailed")

    return (result, failures, in_progress_count)


def get_lint_failures_by_classification(push, classification_ids=None, limit=None):
    """
    Get lint failures filtered by failure classification IDs with optional limit.

    Args:
        push: Push object
        classification_ids: List of classification IDs (default: [6] for new failures only)
                           Common values: 1=fixed by commit, 6=new failure, 8=intermittent
        limit: Optional limit on number of failures to return
    """
    if classification_ids is None:
        classification_ids = [6]

    lint_query = Job.objects.filter(
        Q(machine_platform__platform="lint") | Q(job_type__symbol="mozlint"),
        push=push,
        tier__lte=2,
        failure_classification_id__in=classification_ids,
    ).select_related("machine_platform", "taskcluster_metadata", "job_type")

    # Apply limit if specified
    if limit:
        lint_results = lint_query[:limit]
    else:
        lint_results = lint_query

    result, failures, in_progress_count = get_job_results(lint_results, "testfailed")

    return (result, failures, in_progress_count)
