from treeherder.model.models import Job
from treeherder.push_health.similar_jobs import job_to_dict
from treeherder.push_health.utils import mark_failed_in_parent


def get_build_failures(push, parent_push=None):
    build_failures = Job.objects.filter(push=push, tier__lte=2, result='busted',).select_related(
        'machine_platform', 'taskcluster_metadata'
    )

    failures = [job_to_dict(job) for job in build_failures]

    if parent_push:
        mark_failed_in_parent(failures, get_build_failures(parent_push))

    return failures
