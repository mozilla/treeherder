import logging
import re

from treeherder.model.models import (
    FailureLine,
    Job,
    OptionCollection,
    InvestigatedTests,
    JobType,
)
from treeherder.push_health.utils import clean_config, clean_platform, clean_test, job_to_dict

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


def get_test_failure_jobs(push, all_jobs):
    testfailed_jobs = [
        job
        for job in all_jobs
        if job.result == 'testfailed'
        and job.machine_platform.platform != 'lint'
        and job.job_type.symbol != 'mozline'
        and 'build' not in job.job_type.name
    ]
    failed_job_types = [job.job_type.name for job in testfailed_jobs]

    passing_jobs = Job.objects.filter(
        push=push, job_type__name__in=failed_job_types, result__in=['success', 'unknown']
    ).select_related('job_type', 'machine_platform', 'taskcluster_metadata', 'job_group')

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


def get_line(test_name, action, job, option_map, investigatedTests):
    config = clean_config(option_map[job['option_collection_hash']])
    platform = clean_platform(job['platform'])
    job_name = job['job_type_name']
    job_symbol = job['job_type_symbol']
    job_group = job['job_group_name']
    job_group_symbol = job['job_group_symbol']
    # The 't' ensures the key starts with a character, as required for a query selector
    test_key = re.sub(
        r'\W+', '', 't{}{}{}{}{}'.format(test_name, config, platform, job_name, job_group)
    )
    isInvestigated = False
    investigatedTestId = None
    for investigatedTest in investigatedTests:
        if investigatedTest.test == test_name and job.job_type.id == investigatedTest.job_type.id:
            isInvestigated = True
            investigatedTestId = investigatedTest.id
            break

    return {
        'testName': test_name,
        'action': action,
        'jobName': job_name,
        'jobSymbol': job_symbol,
        'jobGroup': job_group,
        'jobGroupSymbol': job_group_symbol,
        'platform': platform,
        'config': config,
        'key': test_key,
        'jobKey': '{}{}{}{}'.format(config, platform, job_name, job_group),
        'tier': job['tier'],
        'isInvestigated': isInvestigated,
        'investigatedTestId': investigatedTestId,
    }


# noinspection PoetryPackageRequirements
def get_test_failures(push, failed_jobs, likely_regression_labels, result_status):
    # option_map is used to map platforms for the job.option_collection_hash
    option_map = OptionCollection.objects.get_option_collection_map()
    failed_job_labels = list(failed_jobs.keys())
    # using a dict here to avoid duplicates due to multiple failure_lines for
    # each job.
    regressions = {
        'tests': {},
        'unstructuredFailures': [],
    }
    known_issues = {
        'tests': {},
        'unstructuredFailures': [],
    }

    if not len(failed_job_labels):
        return ('none', { 'needInvestigation': regressions, 'knownIssues': known_issues })

    failure_lines = FailureLine.objects.filter(
        action__in=['test_result', 'log', 'crash'],
        job_log__job__push=push,
        job_log__job__job_type__name__in=failed_job_labels,
        job_log__job__result='testfailed',
    ).select_related(
        'job_log',
        'job_log__job',
        'job_log__job__job_type',
        'job_log__job__job_group',
        'job_log__job__machine_platform',
        'job_log__job__taskcluster_metadata',
    )
    investigatedTests = InvestigatedTests.objects.filter(push=push)
    # Keep track of these so that we can add them to the 'otherJobs'
    labels_without_failure_lines = failed_job_labels.copy()

    for failure_line in failure_lines:
        test_name = clean_test(failure_line.test, failure_line.signature, failure_line.message)
        if not test_name:
            continue
        action = failure_line.action.split('_')[0]
        job = failure_line.job_log.job
        job_name = job.job_type.name
        classification = known_issues

        if job_name in likely_regression_labels:
            classification = regressions

        if job_name in labels_without_failure_lines:
            labels_without_failure_lines.remove(job_name)

        line = get_line(test_name, action, job_to_dict(job), option_map, investigatedTests)
        if line['key'] not in classification['tests']:
            classification['tests'][line['key']] = line

    # Any labels that were not in a FailureLine should go into the appropriate bucket 'otherJobs' list.
    for label in labels_without_failure_lines:
        bucket = regressions if label in likely_regression_labels else known_issues
        bucket['unstructuredFailures'].append(
            get_line(None, None, failed_jobs[label][0], option_map, investigatedTests)
        )

    regressions['tests'] = regressions['tests'].values()
    known_issues['tests'] = known_issues['tests'].values()

    result = 'pass'
    if len(regressions['tests']):
        result = 'fail'
    elif 'unknown' in result_status:
        result = 'unknown'

    return (result, {'needInvestigation': regressions, 'knownIssues': known_issues})


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
