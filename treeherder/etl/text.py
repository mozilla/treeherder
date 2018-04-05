# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import re

import six

if len(u"\U0010FFFF") != 1:
    raise Exception('Python has been compiled in UCS-2 mode which is not supported.')

# Regexp that matches all non-BMP unicode characters.
if six.PY3:
    filter_re = re.compile(r"([\U00010000-\U0010FFFF])")
else:
    # The `ur` notation causes a syntax error when this file is parsed by Python 3,
    # so we use `r` and rely on the unicode_literals __future__ import to turn this
    # into a unicode literal instead.
    filter_re = re.compile(r"([\U00010000-\U0010FFFF])", re.U)


def convert_unicode_character_to_ascii_repr(match_obj):
    """
    Converts a matched pattern from a unicode character to an ASCII representation

    For example the emoji 🍆 would get converted to the literal <U+01F346>
    """
    match = match_obj.group(0)
    code_point = ord(match)

    hex_repr = hex(code_point)
    hex_code_point = hex_repr[2:]

    hex_value = hex_code_point.zfill(6).upper()

    return '<U+{}>'.format(hex_value)


def astral_filter(text):
    if text is None:
        return text

    return filter_re.sub(convert_unicode_character_to_ascii_repr, text)
