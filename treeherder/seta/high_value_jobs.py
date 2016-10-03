import logging

from treeherder.etl.seta import job_priorities_to_jobtypes

logger = logging.getLogger(__name__)


def is_matched(failure, removals):
    found = False
    if failure in removals:
        found = True

    return found


def check_removal(failures, removals):
    results = {}
    for failure in failures:
        results[failure] = []
        for failure_job in failures[failure]:
            found = is_matched(failure_job, removals)

            # we will add the test to the resulting structure unless we find a match
            # in the jobtype we are trying to ignore.
            if not found:
                results[failure].append(failure_job)

        if len(results[failure]) == 0:
            del results[failure]

    return results


def build_removals(active_jobs, failures, target):
    """
    active_jobs - all possible desktop & android jobs on Treeherder (no PGO)
    failures - list of all failures
    target - percentage of failures we're going to process

    Return list of jobs to remove and list of revisions that are regressed
    """
    # Determine the number of failures we're going to process
    number_of_failures = int((target / 100) * len(failures))
    low_value_jobs = []
    failures_root_cause = []

    for jobtype in active_jobs:
        # Determine if removing an active job will reduce the number of failures we would catch
        # or stay the same
        remaining_failures = check_removal(failures, [jobtype])

        if len(remaining_failures) >= number_of_failures:
            low_value_jobs.append(jobtype)
            failures = remaining_failures
        else:
            failed_revisions = []
            for revision in failures:
                if revision not in remaining_failures:
                    failed_revisions.append(revision)
                    failures_root_cause.append(revision)

            logger.info("jobtype: %s is the root failure(s) of these %s revisions" % (
                jobtype, failed_revisions))

    return low_value_jobs, failures_root_cause


def remove_root_cause_failures(failures, failures_root_cause):
    for revision in failures_root_cause:
        del failures[revision]
    return failures


def invert_index(failures, active_jobs):
    inv_map = {}

    for revision, jobtypes in failures.iteritems():
        for job in active_jobs:
            found = is_matched(job, jobtypes)
            if found:
                inv_map[str(job)] = inv_map.get(str(job), [])
                inv_map[str(job)].append(revision)

    maximum = 1
    for jobtype in sorted(inv_map):
        if len(inv_map[jobtype]) > maximum:
            maximum = len(inv_map[jobtype])
            max_job = jobtype

    if maximum == 1:
        return failures, None

    for revision in inv_map[max_job]:
        del failures[revision]

    return failures, max_job


def get_high_value_jobs(fixed_by_commit_jobs, target=100):
    """
    fixed_by_commit_jobs:
        Revisions and jobs that have been starred that are fixed with a push or a bug
    target:
        Percentage of failures to analyze
    """
    total = len(fixed_by_commit_jobs)
    logger.info("Processing %s failures" % total)
    active_jobs = job_priorities_to_jobtypes()

    low_value_jobs, failures_root_cause = build_removals(
        active_jobs=active_jobs,
        failures=fixed_by_commit_jobs,
        target=target)

    # Only return high value jobs
    for low_value_job in low_value_jobs:
        try:
            active_jobs.remove(low_value_job)
        except ValueError:
            logger.warning("%s is missing from the job list" % low_value_job)

    total = len(fixed_by_commit_jobs)
    total_detected = check_removal(fixed_by_commit_jobs, low_value_jobs)
    percent_detected = 100 * len(total_detected) / total
    logger.info("We will detect %.2f%% (%s) of the %s failures" % (
        percent_detected, len(total_detected), total))

    return active_jobs
