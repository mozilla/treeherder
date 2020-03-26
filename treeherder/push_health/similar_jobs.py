from itertools import groupby

from django.db.models import Q

from treeherder.model.models import Job

job_fields = [
    'id',
    'machine_platform_id',
    'option_collection_hash',
    'job_type_id',
    'job_group_id',
    'result',
    'state',
    'failure_classification_id',
    'push_id',
]


def set_matching_passed_jobs(failures, push):
    if len(failures) == 0:
        return

    failed_jobs = {}
    for failure in failures:
        jobs = {job['id']: job for job in failure['failJobs']}
        failed_jobs.update(jobs)

    # Need to OR for each type of job that failed
    query_conditions = []
    for job in failed_jobs.values():
        query_conditions.append(Q(
            option_collection_hash=job['option_collection_hash'],
            machine_platform=job['machine_platform_id'],
            job_type=job['job_type_id'],
        ))
    # ``query`` here will end up being a set of OR conditions for each combination of
    # platform/config/job_type for the failed jobs.  This OR condition will give us a
    # list of passing versions of those same job conditions.
    # Said another way: ``query`` will end up being a bunch of OR conditions for each
    # type of job we want to find that's in a "success" state.  For instance:
    # (platform=x, config=y, job_type=z OR platform=a, config=b, job_type=c OR ...)
    query = query_conditions.pop()
    for condition in query_conditions:
        query |= condition

    passing_jobs = Job.objects.filter(
        push=push,
        result='success'
    ).filter(query).select_related('job_type', 'machine_platform', 'taskcluster_metadata')
    in_progress_jobs = Job.objects.filter(
        push=push,
        result='unknown'
    ).filter(query).select_related('job_type', 'machine_platform', 'taskcluster_metadata')

    #
    # Group the passing jobs into groups based on their platform, option and job_type
    #
    # convert from ORM objects to dicts for when we return this object
    passing_job_dicts = [job_to_dict(job) for job in passing_jobs]
    in_progress_job_dicts = [job_to_dict(job) for job in in_progress_jobs]
    sorted_passing_jobs = sorted(passing_job_dicts, key=get_job_key)
    sorted_in_progress_jobs = sorted(in_progress_job_dicts, key=get_job_key)
    passing_job_map = {key: list(group) for key, group in groupby(sorted_passing_jobs, get_job_key)}
    in_progress_job_map = {key: list(group) for key, group in groupby(sorted_in_progress_jobs, get_job_key)}

    #
    # Assign matching passing jobs to the test failures
    #
    for failure in failures:
        # If the passing jobs has a list matching this failure's jobs, then add them in
        if len(failure['failJobs']):
            # A failure will have the same job_key for all jobs in this push, so use the first one
            job_key = get_job_key(failure['failJobs'][0])
            if job_key in passing_job_map:
                # This sets the ``passJobs`` key in the ``failures`` object that was passed in,
                # which is then returned from the API.
                failure['passJobs'] = passing_job_map[job_key]
            if job_key in in_progress_job_map:
                failure['inProgressJobs'] = in_progress_job_map[job_key]
        # This helps the user when determining if this is an intermittent.  If it
        # gets above 50%, then it's intermittent.
        passed_count = len(failure['passJobs']) + len(failure['passInFailedJobs'])
        # Persist this so it is communicated on the front-end
        failure['passFailRatio'] = passed_count / (len(failure['failJobs']) + passed_count)


def get_job_key(job):
    return '{}-{}-{}'.format(job['machine_platform_id'], job['option_collection_hash'], job['job_type_id'])


def job_to_dict(job):
    job_dict = {field: getattr(job, field) for field in job_fields}
    job_dict.update({
        'job_type_name': job.job_type.name,
        'job_type_symbol': job.job_type.symbol,
        'platform': job.machine_platform.platform,
        'task_id': job.taskcluster_metadata.task_id,
        'run_id': job.taskcluster_metadata.retry_id,
    })
    return job_dict
