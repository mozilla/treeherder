import datetime
import json
from collections import defaultdict

from django.core.cache import cache
from django.forms.models import model_to_dict

from treeherder.model.models import (FailureLine,
                                     OptionCollection)
from treeherder.push_health.classification import (get_grouped,
                                                   set_classifications)
from treeherder.push_health.filter import filter_failure
from treeherder.push_health.similar_jobs import (job_fields,
                                                 set_matching_passed_jobs)
from treeherder.push_health.utils import (clean_config,
                                          clean_platform,
                                          clean_test)

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
            job_log__job__tier=1,
            job_log__job__failure_classification_id=failure_classification_id,
            job_log__job__push__repository_id__in=repository_ids,
            job_log__job__push__time__gt=start_date,
            job_log__job__push__time__lt=end_date,
        ).exclude(
            test=None
        ).select_related(
            'job_log__job__machine_platform', 'job_log__job__push'
        ).values(
            'test',
            'job_log__job__machine_platform__platform',
            'job_log__job__option_collection_hash'
        ).distinct()
        previous_failures = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for line in failure_lines:
            previous_failures[
                clean_test(line['test'])
            ][
                clean_platform(line['job_log__job__machine_platform__platform'])
            ][
                clean_config(option_map[line['job_log__job__option_collection_hash']])
            ] += 1

        cache.set(cache_key, json.dumps(previous_failures), ONE_WEEK_IN_SECONDS)
    else:
        previous_failures = json.loads(previous_failures_json)

    return previous_failures, cache_key


def get_push_failures(push, option_map):
    # Using .distinct(<fields>) here would help by removing duplicate FailureLines
    # for the same job (with different sub-tests), but it's only supported by
    # postgres.  Just using .distinct() has no effect.
    new_failure_lines = FailureLine.objects.filter(
        action='test_result',
        job_log__job__push=push,
        job_log__job__result='testfailed',
        job_log__job__tier=1
    ).exclude(
        test=None
    ).select_related(
        'job_log__job__job_type', 'job_log__job__machine_platform'
    )

    # using a dict here to avoid duplicates due to multiple failure_lines for
    # each job.
    tests = {}
    for failure_line in new_failure_lines:
        test_name = clean_test(failure_line.test)
        if not test_name:
            continue
        job = failure_line.job_log.job
        config = clean_config(option_map[job.option_collection_hash])
        platform = clean_platform(job.machine_platform.platform)
        jobName = job.job_type.name
        jobSymbol = job.job_type.symbol
        test_key = '{}{}{}{}'.format(test_name, config, platform, jobName)

        if test_key not in tests:
            line = {
                'testName': test_name,
                'jobName': jobName,
                'jobSymbol': jobSymbol,
                'platform': platform,
                'config': config,
                'key': test_key,
                'failJobs': [],
                'passJobs': [],
                'logLines': [],
                'suggestedClassification': 'New Failure',
                'confidence': 0,
            }
            tests[test_key] = line

        # This ``test`` was either just added above, or already existed in the ``tests``
        # list in a previous iteration through ``failure_lines``
        test = tests[test_key]
        test['logLines'].append(failure_line.to_mozlog_format())
        if not next((find_job for find_job in test['failJobs'] if find_job['id'] == job.id), False):
            test['failJobs'].append(model_to_dict(job, fields=job_fields))

    # Each line of the sorted list that is returned here represents one test file per platform/
    # config.  Each line will have at least one failing job, but may have several
    # passing/failing jobs associated with it.
    return sorted(tests.values(), key=lambda k: k['testName'])


def get_push_health_test_failures(push, repository_ids):
    # query for jobs for the last two weeks excluding today
    # find tests that have failed in the last 14 days
    # this is very cache-able for reuse on other pushes.
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
    push_failures = get_push_failures(push, option_map)
    filtered_push_failures = [
        failure for failure in push_failures if filter_failure(failure)
    ]

    set_classifications(
        filtered_push_failures,
        intermittent_history,
        fixed_by_commit_history,
    )
    set_matching_passed_jobs(filtered_push_failures, push)
    return get_grouped(filtered_push_failures)
