def filter_failure(failure):
    # TODO: Add multiple filters, as needed
    filters = [filter_job_type_names]

    for test_filter in filters:
        if not test_filter(failure):
            return False
    return True


def filter_job_type_names(failure):
    name = failure['jobName']

    return (
        not name.startswith(('build', 'repackage', 'hazard', 'valgrind', 'spidermonkey'))
        and 'test-verify' not in name
    )
