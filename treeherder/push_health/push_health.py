import datetime
from collections import defaultdict

from django.forms.models import model_to_dict

from treeherder.model.models import (FailureLine,
                                     OptionCollection)
from treeherder.push_health.classification import (get_grouped,
                                                   set_classifications)
from treeherder.push_health.filter import filter_failure
from treeherder.push_health.utils import (clean_config,
                                          clean_platform,
                                          clean_test)

intermittent_history_days = 14
fixed_by_commit_history_days = 30
ignored_log_lines = [
    'Return code: 1',
    'exit status 1',
    'unexpected status',
    'Force-terminating active process(es)'
]


def get_history(failure_classification_id, prior_day, days, option_map, repository_ids):
    start_date = datetime.datetime.now() - datetime.timedelta(days=days)
    failure_lines = FailureLine.objects.filter(
        job_log__job__result='testfailed',
        job_log__job__tier=1,
        job_log__job__failure_classification_id=failure_classification_id,
        job_log__job__push__repository_id__in=repository_ids,
        job_log__job__push__time__gt=start_date,
        job_log__job__push__time__lt=prior_day,
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

    return previous_failures


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
        job = failure_line.job_log.job
        config = clean_config(option_map[job.option_collection_hash])
        platform = clean_platform(job.machine_platform.platform)
        jobName = job.job_type.name
        jobSymbol = job.job_type.symbol
        test_key = '{}{}{}{}'.format(test_name, config, platform, jobName)

        if test_name and test_key not in tests:
            line = {
                'testName': test_name,
                'jobName': jobName,
                'jobSymbol': jobSymbol,
                'platform': platform,
                'config': config,
                'key': test_key,
                'jobs': [],
                'logLines': [],
                'suggestedClassification': 'New Failure',
                'confidence': 0,
            }
            tests[test_key] = line
        test = tests[test_key]
        test['logLines'].append(failure_line.to_mozlog_format())
        if not next((find_job for find_job in test['jobs'] if find_job['id'] == job.id), False):
            test['jobs'].append(model_to_dict(job))

    return sorted(tests.values(), key=lambda k: k['testName'])


def get_push_health_test_failures(push, repository_ids):
    # query for jobs for the last two weeks excluding today
    # find tests that have failed in the last 14 days
    # this is very cache-able for reuse on other pushes.
    option_map = OptionCollection.objects.get_option_collection_map()
    prior_day = push.time.date() - datetime.timedelta(days=2)
    intermittent_history = get_history(4, prior_day, intermittent_history_days, option_map, repository_ids)
    fixed_by_commit_history = get_history(2, prior_day, fixed_by_commit_history_days, option_map, repository_ids)
    push_failures = get_push_failures(push, option_map)
    filtered_push_failures = [
        failure for failure in push_failures if filter_failure(failure)
    ]

    set_classifications(
        filtered_push_failures,
        intermittent_history,
        fixed_by_commit_history,
    )
    return get_grouped(filtered_push_failures)
