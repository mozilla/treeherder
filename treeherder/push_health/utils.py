def clean_test(test_name):
    try:
        clean_name = str(test_name)
    except UnicodeEncodeError:
        return ''

    if clean_name.startswith('pid:'):
        return None

    if ' == ' in clean_name or ' != ' in clean_name:
        if ' != ' in clean_name:
            left, right = clean_name.split(' != ')
        elif ' == ' in clean_name:
            left, right = clean_name.split(' == ')

        if 'tests/layout/' in left and 'tests/layout/' in right:
            left = 'layout%s' % left.split('tests/layout')[1]
            right = 'layout%s' % right.split('tests/layout')[1]
        elif 'build/tests/reftest/tests/' in left and \
             'build/tests/reftest/tests/' in right:
            left = '%s' % left.split('build/tests/reftest/tests/')[1]
            right = '%s' % right.split('build/tests/reftest/tests/')[1]
        elif clean_name.startswith('http://10.0'):
            left = '/tests/'.join(left.split('/tests/')[1:])
            right = '/tests/'.join(right.split('/tests/')[1:])
        clean_name = "%s == %s" % (left, right)

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

    # TODO: does this affect anything?
    if clean_name in ['Main app process exited normally',
                      None,
                      'Last test finished',
                      '(SimpleTest/TestRunner.js)']:
        return None

    clean_name = clean_name.strip()
    clean_name = clean_name.replace('\\', '/')
    clean_name = clean_name.lstrip('/')
    return clean_name


def is_valid_failure_line(line):
    skip_lines = ['Return code:', 'unexpected status', 'unexpected crashes', 'exit status', 'Finished in']
    return not any(skip_line in line for skip_line in skip_lines)
