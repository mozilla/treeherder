from treeherder.model.models import Job
from treeherder.push_health.similar_jobs import job_to_dict


def get_lint_failures(push):
    lint_failures = Job.objects.filter(
        push=push,
        tier__lte=2,
        result='testfailed',
        machine_platform__platform='lint'
    ).select_related('machine_platform')

    return [job_to_dict(job) for job in lint_failures]
