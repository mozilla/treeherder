from treeherder.autoclassify.autoclassify import get_matchers


def test_get_matchers():
    matchers = list(get_matchers())

    assert len(matchers) == 3
    assert all(m.__name__.endswith('_matcher') for m in matchers)
