from treeherder.push_health.utils import get_job_results


def get_lint_failures(push, jobs):
    lint_results = [
        job
        for job in jobs
        if job.machine_platform.platform == 'lint' or job.job_type.symbol == 'mozlint'
    ]
    result, failures, in_progress_count = get_job_results(lint_results, 'testfailed')
    return (result, failures, in_progress_count)
