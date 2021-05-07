import datetime
import json
import logging
import re
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Q

from treeherder.model.models import FailureLine, Job, OptionCollection, InvestigatedTests, JobType
from treeherder.push_health.classification import get_grouped, set_classifications
from treeherder.push_health.filter import filter_failure
from treeherder.push_health.utils import clean_config, clean_platform, clean_test, job_to_dict
from treeherder.webapp.api.utils import REPO_GROUPS

logger = logging.getLogger(__name__)

CACHE_KEY_ROOT = 'failure_history'
ONE_WEEK_IN_SECONDS = 604800
intermittent_history_days = 14
fixed_by_commit_history_days = 30
ignored_log_lines = [
    'Return code: 1',
    'exit status 1',
    'unexpected status',
    'Force-terminating active process(es)',
]


def get_history(
    failure_classification_id, push_date, num_days, option_map, repository_ids, force_update=False
):
    start_date = push_date - datetime.timedelta(days=num_days)
    end_date = push_date - datetime.timedelta(days=2)
    cache_key = f'{CACHE_KEY_ROOT}:{failure_classification_id}:{push_date}'
    previous_failures_json = cache.get(cache_key)

    if not previous_failures_json or force_update:
        failure_lines = (
            FailureLine.objects.filter(
                job_log__job__result='testfailed',
                job_log__job__tier__lte=2,
                job_log__job__failure_classification_id=failure_classification_id,
                job_log__job__push__repository_id__in=repository_ids,
                job_log__job__push__time__gt=start_date,
                job_log__job__push__time__lt=end_date,
            )
            .exclude(test=None)
            .select_related('job_log__job__machine_platform', 'job_log__job__push')
            .values(
                'action',
                'test',
                'signature',
                'message',
                'job_log__job__machine_platform__platform',
                'job_log__job__option_collection_hash',
            )
            .distinct()
        )
        previous_failures = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for line in failure_lines:
            previous_failures[clean_test(line['test'], line['signature'], line['message'])][
                clean_platform(line['job_log__job__machine_platform__platform'])
            ][clean_config(option_map[line['job_log__job__option_collection_hash']])] += 1

        cache.set(cache_key, json.dumps(previous_failures), ONE_WEEK_IN_SECONDS)
    else:
        previous_failures = json.loads(previous_failures_json)

    return previous_failures


# For each failure item in ``tests``, we group all jobs of the exact same type into
# a field called `jobs`.  So it has passed and failed jobs in there.
#
def get_current_test_failures(push, option_map, jobs, investigatedTests=None):
    # Using .distinct(<fields>) here would help by removing duplicate FailureLines
    # for the same job (with different sub-tests), but it's only supported by
    # postgres.  Just using .distinct() has no effect.
    new_failure_lines = FailureLine.objects.filter(
        action__in=['test_result', 'log', 'crash'],
        job_log__job__push=push,
        job_log__job__result='testfailed',
        job_log__job__tier__lte=2,
    ).select_related(
        'job_log__job__job_type',
        'job_log__job__job_group',
        'job_log__job__machine_platform',
        'job_log__job__taskcluster_metadata',
    )
    # using a dict here to avoid duplicates due to multiple failure_lines for
    # each job.
    tests = {}
    all_failed_jobs = {}
    for failure_line in new_failure_lines:
        test_name = clean_test(failure_line.test, failure_line.signature, failure_line.message)
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
        # The 't' ensures the key starts with a character, as required for a query selector
        test_key = re.sub(
            r'\W+', '', 't{}{}{}{}{}'.format(test_name, config, platform, job_name, job_group)
        )
        isClassifiedIntermittent = any(
            job['failure_classification_id'] == 4 for job in jobs[job_name]
        )

        isInvestigated = False
        investigatedTestId = None
        for investigatedTest in investigatedTests:
            if (
                investigatedTest.test == test_name
                and job.job_type.id == investigatedTest.job_type.id
            ):
                isInvestigated = True
                investigatedTestId = investigatedTest.id
                break

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
                'suggestedClassification': 'New Failure',
                'confidence': 0,
                'tier': job.tier,
                'totalFailures': 0,
                'totalJobs': 0,
                'failedInParent': False,
                'isClassifiedIntermittent': isClassifiedIntermittent,
                'isInvestigated': isInvestigated,
                'investigatedTestId': investigatedTestId,
            }
            tests[test_key] = line
        countJobs = len(
            list(filter(lambda x: x['result'] in ['success', 'testfailed'], jobs[job_name]))
        )
        tests[test_key]['totalFailures'] += 1
        tests[test_key]['totalJobs'] = countJobs

    # Each line of the sorted list that is returned here represents one test file per platform/
    # config.  Each line will have at least one failing job, but may have several
    # passing/failing jobs associated with it.
    return sorted(tests.values(), key=lambda k: k['testName'])


def has_job(job, job_list):
    return next((find_job for find_job in job_list if find_job['id'] == job.id), False)


def has_line(failure_line, log_line_list):
    return next(
        (find_line for find_line in log_line_list if find_line['line_number'] == failure_line.line),
        False,
    )


def get_test_failure_jobs(push):
    testfailed_jobs = (
        Job.objects.filter(
            push=push,
            tier__lte=2,
            result='testfailed',
        )
        .exclude(
            Q(machine_platform__platform='lint')
            | Q(job_type__symbol='mozlint')
            | Q(job_type__name__contains='build'),
        )
        .select_related('job_type', 'machine_platform', 'taskcluster_metadata')
    )
    failed_job_types = [job.job_type.name for job in testfailed_jobs]

    passing_jobs = Job.objects.filter(
        push=push, job_type__name__in=failed_job_types, result__in=['success', 'unknown']
    ).select_related('job_type', 'machine_platform', 'taskcluster_metadata')

    jobs = {}
    result_status = set()

    def add_jobs(job_list):
        for job in job_list:
            result_status.add(job.result)
            if job.job_type.name in jobs:
                jobs[job.job_type.name].append(job_to_dict(job))
            else:
                jobs[job.job_type.name] = [job_to_dict(job)]

    add_jobs(testfailed_jobs)
    add_jobs(passing_jobs)

    for job in jobs:
        (jobs[job]).sort(key=lambda x: x['start_time'])

    return (result_status, jobs)


def get_test_failures(
    push,
    jobs,
    result_status=set(),
):
    logger.debug('Getting test failures for push: {}'.format(push.id))
    # query for jobs for the last two weeks excluding today
    # find tests that have failed in the last 14 days
    # this is very cache-able for reuse on other pushes.
    result = 'pass'

    if not len(jobs):
        return ('none', get_grouped([]))

    repository_ids = REPO_GROUPS['trunk']
    # option_map is used to map platforms for the job.option_collection_hash
    option_map = OptionCollection.objects.get_option_collection_map()
    push_date = push.time.date()
    intermittent_history = get_history(
        4, push_date, intermittent_history_days, option_map, repository_ids
    )
    fixed_by_commit_history = get_history(
        2, push_date, fixed_by_commit_history_days, option_map, repository_ids
    )
    investigatedTests = InvestigatedTests.objects.filter(push=push)

    # ``push_failures`` are tests that have FailureLine records created by our Log Parser.
    #     These are tests we are able to show to examine to see if we can determine they are
    #     intermittent.  If they are not, we tell the user they need investigation.
    # These are failures ONLY for the current push, not relative to history.
    push_failures = get_current_test_failures(push, option_map, jobs, investigatedTests)
    filtered_push_failures = [failure for failure in push_failures if filter_failure(failure)]

    # Based on the intermittent and FixedByCommit history, set the appropriate classification
    # where we think each test falls.
    set_classifications(
        filtered_push_failures,
        intermittent_history,
        fixed_by_commit_history,
    )

    failures = get_grouped(filtered_push_failures)

    if len(failures['needInvestigation']):
        result = 'fail'
    elif 'unknown' in result_status:
        result = 'unknown'

    return (result, failures)


def get_test_in_progress_count(push):
    test_types = JobType.objects.exclude(
        name__contains="build",
        symbol='mozlint',
    )
    return (
        Job.objects.filter(
            push=push,
            tier__lte=2,
            result='unknown',
            job_type__in=test_types,
        )
        .exclude(machine_platform__platform='lint')
        .select_related('machine_platform')
        .count()
    )
