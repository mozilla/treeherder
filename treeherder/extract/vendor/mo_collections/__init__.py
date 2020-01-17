# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

from mo_collections.unique_index import UniqueIndex


def reverse(values):
    """
    REVERSE - WITH NO SIDE EFFECTS!
    """
    output = list(values)
    output.reverse()
    return output


def right(values, num):
    """
    KEEP num ELEMENTS FROM THE RIGHT
    """
    if num <= 0:
        return values[:0]
    else:
        return values[-num:]


def not_right(values, num):
    """
    REMOVE num ELEMENTS FROM THE RIGHT
    """
    if num <= 0:
        return values
    else:
        return values[:-num]


def left(values, num):
    """
    KEEP num ELEMENTS FROM THE LEFT
    """
    if num <= 0:
        return values[:0]
    else:
        return values[:num]


def not_left(values, num):
    """
    REMOVE num ELEMENTS FROM THE LEFT
    """
    if num <= 0:
        return values
    else:
        return values[num:]
