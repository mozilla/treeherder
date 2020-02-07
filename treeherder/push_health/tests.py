import datetime
import json
import logging
import re
from collections import defaultdict

from django.core.cache import cache

from treeherder.model.models import (FailureLine,
                                     Job,
                                     OptionCollection)
from treeherder.push_health.classification import (get_grouped,
                                                   set_classifications)
from treeherder.push_health.filter import filter_failure
from treeherder.push_health.similar_jobs import (job_to_dict,
                                                 set_matching_passed_jobs)
from treeherder.push_health.utils import (clean_config,
                                          clean_platform,
                                          clean_test)

logger = logging.getLogger(__name__)

ONE_WEEK_IN_SECONDS = 604800
intermittent_history_days = 14
fixed_by_commit_history_days = 30
ignored_log_lines = [
    'Return code: 1',
    'exit status 1',
    'unexpected status',
    'Force-terminating active process(es)'
]


def get_history(failure_classification_id, push_date, num_days, option_map, repository_ids, force_update=False):
    start_date = push_date - datetime.timedelta(days=num_days)
    end_date = push_date - datetime.timedelta(days=2)
    cache_key = 'failure_history:{}:{}'.format(failure_classification_id, push_date)
    previous_failures_json = cache.get(cache_key)

    if not previous_failures_json or force_update:
        failure_lines = FailureLine.objects.filter(
            job_log__job__result='testfailed',
            job_log__job__tier__lte=2,
            job_log__job__failure_classification_id=failure_classification_id,
            job_log__job__push__repository_id__in=repository_ids,
            job_log__job__push__time__gt=start_date,
            job_log__job__push__time__lt=end_date,
        ).exclude(
            test=None
        ).select_related(
            'job_log__job__machine_platform', 'job_log__job__push'
        ).values(
            'action',
            'test',
            'signature',
            'message',
            'job_log__job__machine_platform__platform',
            'job_log__job__option_collection_hash'
        ).distinct()
        previous_failures = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for line in failure_lines:
            previous_failures[
                clean_test(line['action'], line['test'], line['signature'], line['message'])
            ][
                clean_platform(line['job_log__job__machine_platform__platform'])
            ][
                clean_config(option_map[line['job_log__job__option_collection_hash']])
            ] += 1

        cache.set(cache_key, json.dumps(previous_failures), ONE_WEEK_IN_SECONDS)
    else:
        previous_failures = json.loads(previous_failures_json)

    return previous_failures, cache_key


# For each failure item in ``tests``, we have 3 categories of jobs that are associated with it in order
# to help determine if the test is 'intermittent' or not:
#
# 1. failJobs: These are jobs where this test has specifically failed in the job
#    (it has a FailureLine record with the tests name).
# 2. passJobs: These are jobs where this test was run and all tests, including this one, passed.
#    (The job is green.)
# 3. passInFailedJobs: These are jobs that overall came back as 'testfailed', however, the
#    test in question did NOT fail (we have no FailureLine record matching this test).  So, even
#    though the job failed, we count it as a 'pass' for the test in question.  This 'pass' is
#    used for the pass/fail ratio on the test to help determine if it is intermittent.
#
def get_current_test_failures(push, option_map):
    all_testfailed = Job.objects.filter(
        push=push,
        tier__lte=2,
        result='testfailed',
    ).exclude(machine_platform__platform='lint')
    # Using .distinct(<fields>) here would help by removing duplicate FailureLines
    # for the same job (with different sub-tests), but it's only supported by
    # postgres.  Just using .distinct() has no effect.
    new_failure_lines = FailureLine.objects.filter(
        action__in=['test_result', 'log', 'crash'],
        job_log__job__push=push,
        job_log__job__result='testfailed',
        job_log__job__tier__lte=2
    ).select_related(
        'job_log__job__job_type', 'job_log__job__job_group', 'job_log__job__machine_platform'
    )

    # using a dict here to avoid duplicates due to multiple failure_lines for
    # each job.
    tests = {}
    all_failed_jobs = {}
    for failure_line in new_failure_lines:
        test_name = clean_test(
            failure_line.action, failure_line.test, failure_line.signature, failure_line.message
        )
        if not test_name:
            continue
        job = failure_line.job_log.job
        config = clean_config(option_map[job.option_collection_hash])
        platform = clean_platform(job.machine_platform.platform)
        job_name = job.job_type.name
        job_symbol = job.job_type.symbol
        job_group = job.job_group.name
        job_group_symbol = job.job_group.symbol
        job.job_key = '{}{}{}{}'.format(config, platform, job_name, job_group)
        all_failed_jobs[job.id] = job
        test_key = re.sub(r'\W+', '', '{}{}{}{}{}'.format(test_name, config, platform, job_name, job_group))

        if test_key not in tests:
            line = {
                'testName': test_name,
                'action': failure_line.action.split('_')[0],
                'jobName': job_name,
                'jobSymbol': job_symbol,
                'jobGroup': job_group,
                'jobGroupSymbol': job_group_symbol,
                'platform': platform,
                'config': config,
                'key': test_key,
                'jobKey': job.job_key,
                'inProgressJobs': [],
                'failJobs': [],
                'passJobs': [],
                'passInFailedJobs': [],  # This test passed in a job that failed for another test
                'logLines': [],
                'suggestedClassification': 'New Failure',
                'confidence': 0,
                'tier': job.tier,
            }
            tests[test_key] = line

        # This ``test`` was either just added above, or already existed in the ``tests``
        # list in a previous iteration through ``failure_lines``
        test = tests[test_key]
        if not has_line(failure_line, test['logLines']):
            test['logLines'].append(failure_line.to_mozlog_format())

        if not has_job(job, test['failJobs']):
            test['failJobs'].append(job_to_dict(job))

    # Check each test to find jobs where it passed, even if the job itself failed due to another test
    for test in tests.values():
        for failed_job in all_failed_jobs.values():
            if not has_job(failed_job, test['failJobs']) and test['jobKey'] == failed_job.job_key:
                test['passInFailedJobs'].append(job_to_dict(failed_job))

    # filter out testfailed jobs that are supported by failureline to get unsupported jobs
    supported_job_ids = all_failed_jobs.keys()
    unsupported_jobs = [job_to_dict(job) for job in all_testfailed if job.id not in supported_job_ids]

    # Each line of the sorted list that is returned here represents one test file per platform/
    # config.  Each line will have at least one failing job, but may have several
    # passing/failing jobs associated with it.
    return (sorted(tests.values(), key=lambda k: k['testName']), unsupported_jobs)


def has_job(job, job_list):
    return next((find_job for find_job in job_list if find_job['id'] == job.id), False)


def has_line(failure_line, log_line_list):
    return next((find_line for find_line in log_line_list if find_line['line_number'] == failure_line.line), False)


def get_test_failures(push, repository_ids):
    logger.info('Getting test failures for push: {}'.format(push.id))
    # query for jobs for the last two weeks excluding today
    # find tests that have failed in the last 14 days
    # this is very cache-able for reuse on other pushes.

    # option_map is used to map platforms for the job.option_collection_hash
    option_map = OptionCollection.objects.get_option_collection_map()
    push_date = push.time.date()
    intermittent_history, cache_key = get_history(
        4,
        push_date,
        intermittent_history_days,
        option_map,
        repository_ids)
    fixed_by_commit_history, cache_key = get_history(
        2,
        push_date,
        fixed_by_commit_history_days,
        option_map,
        repository_ids)

    # ``push_failures`` are tests that have FailureLine records created by out Log Parser.
    #     These are tests we are able to show to examine to see if we can determine they are
    #     intermittent.  If they are not, we tell the user they need investigation.
    # ``unsupported_jobs`` are jobs that either don't have an ``*_errorsummary.log`` file,
    #     or have one that does not have enough information for us to interpret.  So we place
    #     these jobs into the "Unsupported" category.  The jobs either need to change either at
    #     the test-level or harness level so we can interpret them.  In some cases, the Treeherder
    #     code here can be updated to interpret information we don't currently handle.
    # These are failures ONLY for the current push, not relative to history.
    push_failures, unsupported_jobs = get_current_test_failures(push, option_map)
    filtered_push_failures = [
        failure for failure in push_failures if filter_failure(failure)
    ]

    # Based on the intermittent and FixedByCommit history, set the appropriate classification
    # where we think each test falls.
    set_classifications(
        filtered_push_failures,
        intermittent_history,
        fixed_by_commit_history,
    )
    # If we have failed tests that have also passed, we gather them both.  This helps us determine
    # if a job is intermittent based on the current push results.
    set_matching_passed_jobs(filtered_push_failures, push)

    failures = get_grouped(filtered_push_failures)
    failures['unsupported'] = unsupported_jobs

    return failures
