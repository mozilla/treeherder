from treeherder.webapp.api.utils import UrlQueryFilter


def test_single_filter():
    input = {
        "name": "john",
        "age__gte": 30,
        "weight__lt": 80,
        "gender__in": "male,female"
    }

    expected = {
        'name': set([('=', 'john')]),
        'age': set([('>=', 30)]),
        'weight': set([('<', 80)]),
        'gender': set([('IN', ("male", "female"))])
    }

    filter = UrlQueryFilter(input)
    actual = filter.conditions

    for k in expected:
        assert actual[k] == expected[k]


def test_multiple_filters():
    input = {
        "name": "john",
        "age__gte": 30,
        "age__lt": 80,
    }

    expected = {
        'name': set([('=', 'john')]),
        'age': set([('>=', 30), ('<', 80)]),
    }

    filter = UrlQueryFilter(input)
    actual = filter.conditions

    for k in expected:
        assert actual[k] == expected[k]


def test_get_multiple_value():
    input = {
        "name": "john",
        "age__gte": 30,
        "age__lt": 80,
    }

    expected = set([('>=', 30), ('<', 80)])

    filter = UrlQueryFilter(input)
    actual = filter.get("age")

    assert actual == expected


def test_get_single_value():
    input = {
        "name": "john",
        "age__gte": 30,
        "age__lt": 80,
    }

    expected = "john"

    filter = UrlQueryFilter(input)
    actual = filter.get("name")

    assert actual == expected


def test_get_default_value():
    input = {
        "name": "john",
        "age__gte": 30,
        "age__lt": 80,
    }
    expected = "bar"

    filter = UrlQueryFilter(input)
    actual = filter.get("foo", "bar")

    assert expected == actual
