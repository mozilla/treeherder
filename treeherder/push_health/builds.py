from treeherder.push_health.utils import get_job_results


def get_build_failures(push, likely_build_regression_labels, jobs):
    build_results = [job for job in jobs if job.job_type.name in likely_build_regression_labels]
    result, failures, in_progress_count = get_job_results(build_results, 'busted')
    return (result, failures, in_progress_count)
