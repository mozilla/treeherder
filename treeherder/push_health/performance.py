from treeherder.model.models import Job, JobGroup
from treeherder.push_health.similar_jobs import job_to_dict


def get_perf_failures(push):
    perf_groups = JobGroup.objects.filter(name__contains='performance')
    perf_failures = Job.objects.filter(
        push=push, tier__lte=2, result='testfailed', job_group__in=perf_groups
    ).select_related('machine_platform', 'taskcluster_metadata')

    return [job_to_dict(job) for job in perf_failures]
