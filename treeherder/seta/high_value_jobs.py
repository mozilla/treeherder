import logging

from treeherder.etl.seta import Treecodes

LOG = logging.getLogger(__name__)


def get_distinct_tuples(repo_name='mozilla-inbound'):
    '''
    Returned data:
      [("windows8-64", "debug", "web-platform-tests-1"), ...]
    '''
    return Treecodes(repo_name).query_jobtypes()


def is_matched(failure, removals):
    found = False
    if failure in removals:
        found = True
    else:
        # XXX: Why do we also compare three other ways ''?
        #      See if we can get rid of this
        for job in removals:
            if failure in (('', job[1:2]), (job[0], '', job[2]), (job[0:1], '')):
                found = True
                break

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

            LOG.info("jobtype: %s is the root failure(s) of these %s revisions" % (
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


def get_high_value_jobs(revisions_fixed_by_commit_plus_tagged_jobs, target=100):
    """
    revisions_fixed_by_commit_plus_tagged_jobs:
        Revisions and jobs that have been starred for fixing a commit or associated to a bug
    target:
        Percentage of failures to analyze
    """
    total = len(revisions_fixed_by_commit_plus_tagged_jobs)
    LOG.info("Processing %s failures" % total)
    # This fetches the jobtypes' endpoint
    # List of jobs (platform, platform_opt, testtype)
    # It reads the runnable API, it calculates the testtype for each build system type
    # It also skips PGO jobs
    # XXX: We could query the job priorities table and skip the PGO jobs here
    active_jobs = get_distinct_tuples()

    low_value_jobs, failures_root_cause = build_removals(
        active_jobs=active_jobs,
        failures=revisions_fixed_by_commit_plus_tagged_jobs,
        target=target)

    # Only return high value jobs
    for low_value_job in low_value_jobs:
        try:
            active_jobs.remove(low_value_job)
        except ValueError:
            LOG.warning("%s is missing from the job list" % low_value_job)

    total = len(revisions_fixed_by_commit_plus_tagged_jobs)
    total_detected = check_removal(revisions_fixed_by_commit_plus_tagged_jobs, low_value_jobs)
    percent_detected = 100 * len(total_detected) / total
    LOG.info("We will detect %.2f%% (%s) of the %s failures" %
             (percent_detected, len(total_detected), total))

    return active_jobs
