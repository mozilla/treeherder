from treeherder.model.models import Job
from treeherder.push_health.similar_jobs import job_to_dict


def get_build_failures(push):
    build_failures = Job.objects.filter(
        push=push,
        tier__lte=2,
        result='busted',
    )

    return [job_to_dict(job) for job in build_failures]
