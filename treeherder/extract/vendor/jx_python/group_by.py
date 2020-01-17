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

import math

from jx_base.container import Container
from jx_base.expressions import jx_expression
from jx_base.language import is_expression
from mo_dots import Data, FlatList, Null, listwrap
from mo_dots.lists import sequence_types
from mo_future import binary_type, text
from mo_logs import Log
from mo_logs.exceptions import Except

from jx_python.expressions import jx_expression_to_function


def groupby(data, keys=None, contiguous=False):
    """
    :param data: list of data to group
    :param keys: (list of) property path name
    :param contiguous: MAINTAIN THE ORDER OF THE DATA, STARTING THE NEW GROUP WHEN THE SELECTOR CHANGES
    :return: return list of (keys, values) PAIRS, WHERE
                 keys IS IN LEAF FORM (FOR USE WITH {"eq": terms} OPERATOR
                 values IS GENERATOR OF ALL VALUE THAT MATCH keys
    """
    if isinstance(data, Container):
        return data.groupby(keys)

    try:
        if not data:
            return Null

        keys = listwrap(keys)
        if not contiguous:
            from jx_python import jx
            data = jx.sort(data, keys)

        if len(keys) == 0 or len(keys) == 1 and keys[0] == '.':
            return _groupby_value(data)

        if any(is_expression(k) for k in keys):
            raise Log.error("can not handle expressions")

        accessor = jx_expression_to_function(jx_expression({"tuple": keys}))  # CAN RETURN Null, WHICH DOES NOT PLAY WELL WITH __cmp__
        return _groupby_keys(data, keys, accessor)
    except Exception as e:
        Log.error("Problem grouping", cause=e)


def _groupby_value(data):
    start = 0
    prev = data[0]
    for i, d in enumerate(data):
        curr = d
        if curr != prev:
            yield prev, data[start:i:]
            start = i
            prev = curr
    yield prev, data[start::]


def _groupby_keys(data, key_paths, accessors):
    start = 0
    prev = accessors(data[0])
    for i, d in enumerate(data):
        curr = accessors(d)
        if curr != prev:
            group = {}
            for k, gg in zip(key_paths, prev):
                group[k] = gg
            yield Data(group), data[start:i:]
            start = i
            prev = curr
    group = {}
    for k, gg in zip(key_paths, prev):
        group[k] = gg
    yield Data(group), data[start::]


def groupby_multiset(data, min_size, max_size):
    # GROUP multiset BASED ON POPULATION OF EACH KEY, TRYING TO STAY IN min/max LIMITS
    if min_size == None:
        min_size = 0

    total = 0
    i = 0
    g = list()
    for k, c in data.items():
        if total < min_size or total + c < max_size:
            total += c
            g.append(k)
        elif total < max_size:
            yield (i, g)
            i += 1
            total = c
            g = [k]

        if total >= max_size:
            Log.error("({{min}}, {{max}}) range is too strict given step of {{increment}}",
                min=min_size,
                max=max_size,
                increment=c
            )

    if g:
        yield (i, g)


def chunk(data, size=0):
    if not size:
        return [data]

    if data.__class__ in sequence_types + (bytearray, text, binary_type):
        # USE SLICING
        def _iter():
            num = int(math.ceil(len(data)/size))
            for i in range(num):
                output = (i, data[i * size:i * size + size:])
                yield output

        return _iter()

    elif hasattr(data, "__iter__"):
        def _iter():
            g = 0
            out = []
            try:
                for i, d in enumerate(data):
                    out.append(d)
                    if (i + 1) % size == 0:
                        yield g, FlatList(vals=out)
                        g += 1
                        out = []
                if out:
                    yield g, FlatList(vals=out)
            except Exception as e:
                e = Except.wrap(e)
                if out:
                    # AT LEAST TRY TO RETURN WHAT HAS BEEN PROCESSED SO FAR
                    yield g, out
                Log.error("Problem inside jx.chunk", e)

        return _iter()
    else:
        Log.error("not supported")

