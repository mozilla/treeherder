import pytest

from treeherder.utils.taskcluster_lib_scopes import (patternMatch,
                                                     satisfiesExpression)


# satisfiesExpression()
@pytest.mark.parametrize('scopeset, expression', [
    [[], {'AllOf': []}],
    [['A'], {'AllOf': ['A']}],
    [['A', 'B'], 'A'],
    [['a*', 'b*', 'c*'], 'abc'],
    [['abc'], {'AnyOf': ['abc', 'def']}],
    [['def'], {'AnyOf': ['abc', 'def']}],
    [['abc', 'def'], {'AnyOf': ['abc', 'def']}],
    [['abc*'], {'AnyOf': ['abc', 'def']}],
    [['abc*'], {'AnyOf': ['abc']}],
    [['abc*', 'def*'], {'AnyOf': ['abc', 'def']}],
    [['foo'], {'AllOf': [{'AnyOf': [{'AllOf': ['foo']}, {'AllOf': ['bar']}]}]}],
    [['a*', 'b*', 'c*'], {'AnyOf': ['cfoo', 'dfoo']}],
    [['a*', 'b*', 'c*'], {'AnyOf': ['bx', 'by']}],
    [['a*', 'b*', 'c*'], {'AllOf': ['bx', 'cx']}],
    # complex expression with only
    # some AnyOf branches matching
    [
        ['a*', 'b*', 'c*'],
        {'AnyOf': [
            {'AllOf': ['ax', 'jx']},  # doesn't match
            {'AllOf': ['bx', 'cx']},  # does match
            'bbb',
        ]},
    ],
])
def test_expression_is_satisfied(scopeset, expression):
    assert satisfiesExpression(scopeset, expression) is True


@pytest.mark.parametrize('scopeset, expression', [
      [[], {'AnyOf': []}],
      [[], 'missing-scope'],
      [['wrong-scope'], 'missing-scope'],
      [['ghi'], {'AnyOf': ['abc', 'def']}],
      [['ghi*'], {'AnyOf': ['abc', 'def']}],
      [['ghi', 'fff'], {'AnyOf': ['abc', 'def']}],
      [['ghi*', 'fff*'], {'AnyOf': ['abc', 'def']}],
      [['abc'], {'AnyOf': ['ghi']}],
      [['abc*'], {'AllOf': ['abc', 'ghi']}],
      [[''], {'AnyOf': ['abc', 'def']}],
      [['abc:def'], {'AnyOf': ['abc', 'def']}],
      [['xyz', 'abc'], {'AllOf': [{'AnyOf': [{'AllOf': ['foo']}, {'AllOf': ['bar']}]}]}],
      [['a*', 'b*', 'c*'], {'AllOf': ['bx', 'cx', {'AnyOf': ['xxx', 'yyyy']}]}],
])
def test_expression_is_not_satisfied(scopeset, expression):
    assert not satisfiesExpression(scopeset, expression)


@pytest.mark.parametrize('scopeset', [
    None,
    'scopeset_argument',
    ('scopeset', 'argument'),
    {'scopeset', 'argument'},
])
def test_wrong_scopeset_type_raises_exception(scopeset):
    with pytest.raises(TypeError):
        satisfiesExpression(scopeset, 'in-tree:hook-action:{hook_group_id}/{hook_id}')


# patternMatch()
def test_identical_scope_and_pattern_are_matching():
    assert patternMatch('mock:scope', 'mock:scope') is True


@pytest.mark.parametrize('pattern, scope', [
    ('matching*', 'matching'),
    ('matching*', 'matching/scope')
])
def test_starred_patterns_are_matching(pattern, scope):
    assert patternMatch(pattern, scope) is True


@pytest.mark.parametrize('pattern, scope', [
    ('matching*', 'mismatching'),
    ('match*ing', 'matching'),
    ('*matching', 'matching')
])
def test_starred_patterns_dont_matching(pattern, scope):
    assert not patternMatch(pattern, scope)
