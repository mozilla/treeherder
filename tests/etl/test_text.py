# -*- coding: utf-8 -*-
from treeherder.etl.text import astral_filter, filter_re


def test_filter_re_matching():
    points = [
        u"\U00010045",
        u"\U00010053",
        u"\U00010054",
    ]
    for point in points:
        assert bool(filter_re.match(point)) is True


def test_filter_not_matching():
    points = [
        u"\U00000045",
        u"\U00000053",
        u"\U00000054",
    ]
    for point in points:
        assert bool(filter_re.match(point)) is False


def test_astra_filter_emoji():
    output = astral_filter(u'🍆')
    expected = '<U+01F346>'
    assert output == expected


def test_astra_filter_hex_value():
    """check the expected outcome is also not changed"""
    hex_values = '\U00000048\U00000049'
    assert hex_values == astral_filter(hex_values)
