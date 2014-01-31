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
    actual = filter.parse()

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
    actual = filter.parse()

    for k in expected:
        assert actual[k] == expected[k]
