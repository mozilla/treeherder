# These strings will be omitted from test paths to more easily correllate
# them to other test paths.
trim_parts = [
    'TEST-UNEXPECTED-FAIL',
    'REFTEST TEST-UNEXPECTED-FAIL',
    'TEST-UNEXPECTED-PASS',
    'REFTEST TEST-UNEXPECTED-PASS',
]


def clean_test(action, test, signature, message):
    try:
        clean_name = 'Non-Test Error'
        if action == 'test_result':
            clean_name = test
        elif action == 'crash':
            clean_name = signature
        elif action == 'log':
            clean_name = message

    except UnicodeEncodeError:
        return ''

    if clean_name.startswith('pid:'):
        return None

    if ' == ' in clean_name or ' != ' in clean_name:
        splitter = ' == ' if ' == ' in clean_name else ' != '
        left, right, *rest = clean_name.split(splitter)

        if 'tests/layout/' in left and 'tests/layout/' in right:
            left = 'layout%s' % left.split('tests/layout')[1]
            right = 'layout%s' % right.split('tests/layout')[1]
        elif 'build/tests/reftest/tests/' in left and 'build/tests/reftest/tests/' in right:
            left = '%s' % left.split('build/tests/reftest/tests/')[1]
            right = '%s' % right.split('build/tests/reftest/tests/')[1]
        elif clean_name.startswith('http://10.0'):
            left = '/tests/'.join(left.split('/tests/')[1:])
            right = '/tests/'.join(right.split('/tests/')[1:])
        clean_name = "%s%s%s" % (left, splitter, right)

    if 'test_end for' in clean_name:
        clean_name = clean_name.split()[2]

    if 'build/tests/reftest/tests/' in clean_name:
        clean_name = clean_name.split('build/tests/reftest/tests/')[1]

    if 'jsreftest.html' in clean_name:
        clean_name = clean_name.split('test=')[1]

    if clean_name.startswith('http://10.0'):
        clean_name = '/tests/'.join(clean_name.split('/tests/')[1:])

    # http://localhost:50462/1545303666006/4/41276-1.html
    if clean_name.startswith('http://localhost:'):
        parts = clean_name.split('/')
        clean_name = parts[-1]

    if " (finished)" in clean_name:
        clean_name = clean_name.split(" (finished)")[0]

    # Now that we don't bail on a blank test_name, these filters
    # may sometimes apply.
    if clean_name in ['Last test finished', '(SimpleTest/TestRunner.js)']:
        return None

    clean_name = clean_name.strip()
    clean_name = clean_name.replace('\\', '/')
    clean_name = clean_name.lstrip('/')

    if '|' in clean_name:
        parts = clean_name.split('|')
        clean_parts = filter(lambda x: not x.strip() in trim_parts, parts)
        clean_name = '|'.join(clean_parts)

    return clean_name


def clean_config(config):
    # We have found that pgo ~= opt for our needs, so this helps us get a
    # more representative sample size of data.
    if config in ['pgo', 'shippable']:
        config = 'opt'

    return config.encode('ascii', 'ignore').decode('utf-8')


def clean_platform(platform):
    # This is needed because of macosx-qr
    if platform.startswith('macosx64'):
        platform = platform.replace('macosx64', 'osx-10-10')

    return platform.encode('ascii', 'ignore').decode('utf-8')


def is_valid_failure_line(line):
    skip_lines = [
        'Return code:',
        'unexpected status',
        'unexpected crashes',
        'exit status',
        'Finished in',
    ]
    return not any(skip_line in line for skip_line in skip_lines)


def mark_failed_in_parent(failures, parent_failures):
    parent_failure_keys = {get_job_key(job) for job in parent_failures}

    for failure in failures:
        failure['failedInParent'] = get_job_key(failure) in parent_failure_keys


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
    'start_time',
]


def get_job_key(job):
    return '{}-{}-{}'.format(
        job['machine_platform_id'], job['option_collection_hash'], job['job_type_id']
    )


def job_to_dict(job):
    job_dict = {field: getattr(job, field) for field in job_fields}
    job_dict.update(
        {
            'job_type_name': job.job_type.name,
            'job_type_symbol': job.job_type.symbol,
            'platform': job.machine_platform.platform,
            'task_id': job.taskcluster_metadata.task_id,
            'run_id': job.taskcluster_metadata.retry_id,
        }
    )
    return job_dict


def get_job_results(results, failure_type):
    result_status = set()
    result = 'pass'
    failures = []

    for job in results:
        result_status.add(job.result)
        if job.result == failure_type:
            failures.append(job_to_dict(job))

    if len(failures):
        result = 'fail'
    elif 'unknown' in result_status:
        result = 'unknown'

    return (result, failures)
