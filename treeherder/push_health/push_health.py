import datetime
from collections import defaultdict

from treeherder.model.models import (FailureLine,
                                     OptionCollection,
                                     Repository)
from treeherder.push_health.classification import set_classifications
from treeherder.push_health.filter import filter_failure
from treeherder.push_health.utils import clean_test

intermittent_history_days = 14


def get_intermittent_history(prior_day, days, option_map):
    start_date = datetime.datetime.now() - datetime.timedelta(days=days)
    repos = Repository.objects.filter(name__in=['mozilla-inbound', 'autoland', 'mozilla-central'])
    failure_lines = FailureLine.objects.filter(
        job_log__job__result='testfailed',
        job_log__job__tier=1,
        job_log__job__failure_classification_id=4,
        job_log__job__push__repository__in=repos,
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
            line['job_log__job__machine_platform__platform']
        ][
            option_map[line['job_log__job__option_collection_hash']]
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
    ).prefetch_related(
        'job_log__job__text_log_step__errors'
    )

    # using a dict here to avoid duplicates due to multiple failure_lines for
    # each job.
    tests = {}
    for failure_line in new_failure_lines:
        test_name = clean_test(failure_line.test)
        test_key = '{}{}'.format(test_name, failure_line.job_guid)
        if test_name and test_key not in tests:
            job = failure_line.job_log.job
            config = option_map[job.option_collection_hash]
            errors = []
            for step in failure_line.job_log.job.text_log_step.all():
                for error in step.errors.all():
                    if len(errors) < 5:
                        errors.append(error.line)
            line = {
                'testName': test_name,
                'logLines': errors,
                'jobName': job.job_type.name,
                'jobId': job.id,
                'jobClassificationId': job.failure_classification_id,
                'platform': job.machine_platform.platform,
                'suggestedClassification': 'New Failure',
                'config': config,
                'key': test_key,
                'confidence': 0,
            }
            tests[test_key] = line
    return sorted(tests.values(), key=lambda k: k['testName'])


def get_push_health_test_failures(push):
    # query for jobs for the last two weeks excluding today
    # find tests that have failed in the last 14 days
    # this is very cache-able for reuse on other pushes.
    option_map = OptionCollection.objects.get_option_collection_map()
    start_date = push.time.date() - datetime.timedelta(days=1)
    intermittent_history = get_intermittent_history(start_date, intermittent_history_days, option_map)
    push_failures = get_push_failures(push, option_map)
    # push_failures = []
    filtered_push_failures = [
        failure for failure in push_failures if filter_failure(failure)
    ]

    set_classifications(
        filtered_push_failures,
        intermittent_history,
        {},  # TODO: Use fbc history
    )
    return filtered_push_failures
