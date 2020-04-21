import pytest

from treeherder.push_health.utils import (
    clean_config,
    clean_platform,
    clean_test,
    is_valid_failure_line,
)


@pytest.mark.parametrize(
    ('action', 'test', 'signature', 'message', 'expected'),
    [
        ('test_result', 'dis/dat/da/odder/ting', 'sig', 'mess', 'dis/dat/da/odder/ting'),
        ('crash', 'dis/dat/da/odder/ting', 'sig', 'mess', 'sig'),
        ('log', 'dis/dat/da/odder/ting', 'sig', 'mess', 'mess'),
        ('meh', 'dis/dat/da/odder/ting', 'sig', 'mess', 'Non-Test Error'),
        ('test_result', 'pid:dis/dat/da/odder/ting', 'sig', 'mess', None),
        (
            'test_result',
            'tests/layout/this == tests/layout/that',
            'sig',
            'mess',
            'layout/this == layout/that',
        ),
        (
            'test_result',
            'tests/layout/this != tests/layout/that',
            'sig',
            'mess',
            'layout/this != layout/that',
        ),
        (
            'test_result',
            'build/tests/reftest/tests/this != build/tests/reftest/tests/that',
            'sig',
            'mess',
            'this != that',
        ),
        (
            'test_result',
            'http://10.0.5.5/tests/this != http://10.0.5.5/tests/that',
            'sig',
            'mess',
            'this != that',
        ),
        ('test_result', 'build/tests/reftest/tests/this', 'sig', 'mess', 'this'),
        ('test_result', 'test=jsreftest.html', 'sig', 'mess', 'jsreftest.html'),
        ('test_result', 'http://10.0.5.5/tests/this/thing', 'sig', 'mess', 'this/thing'),
        ('test_result', 'http://localhost:5000/tests/this/thing', 'sig', 'mess', 'thing'),
        ('test_result', 'thing is done (finished)', 'sig', 'mess', 'thing is done'),
        ('test_result', 'Last test finished', 'sig', 'mess', None),
        ('test_result', '(SimpleTest/TestRunner.js)', 'sig', 'mess', None),
        ('test_result', '/this\\thing\\there', 'sig', 'mess', 'this/thing/there'),
    ],
)
def test_clean_test(action, test, signature, message, expected):
    assert expected == clean_test(action, test, signature, message)


@pytest.mark.parametrize(
    ('config', 'expected'),
    [('opt', 'opt'), ('debug', 'debug'), ('asan', 'asan'), ('pgo', 'opt'), ('shippable', 'opt'),],
)
def test_clean_config(config, expected):
    assert expected == clean_config(config)


@pytest.mark.parametrize(
    ('platform', 'expected'),
    [
        ('macosx64 opt and such', 'osx-10-10 opt and such'),
        ('linux doohickey', 'linux doohickey'),
        ('windows gizmo', 'windows gizmo'),
    ],
)
def test_clean_platform(platform, expected):
    assert expected == clean_platform(platform)


@pytest.mark.parametrize(
    ('line', 'expected'),
    [
        ('Return code:', False),
        ('unexpected status', False),
        ('unexpected crashes', False),
        ('exit status', False),
        ('Finished in', False),
        ('expect magic', True),
    ],
)
def test_is_valid_failure_line(line, expected):
    assert expected == is_valid_failure_line(line)
