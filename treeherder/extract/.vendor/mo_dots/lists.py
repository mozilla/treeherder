# encoding: utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#

from __future__ import absolute_import, division, unicode_literals

import types
from copy import deepcopy

from mo_future import generator_types, first

from mo_dots import CLASS, coalesce, to_data, from_data
from mo_dots.nones import Null

_list = str("list")
_get = object.__getattribute__
_set = object.__setattr__
_emit_slice_warning = True


Log, _datawrap = [None]*2


def _get_list(self):
    return _get(self, _list)


def _late_import():
    global _datawrap
    global Log

    from mo_dots.objects import datawrap as _datawrap

    try:
        from mo_logs import Log
    except Exception:
        from mo_dots.utils import PoorLogger as Log

    _ = _datawrap


class FlatList(object):
    """
    ENCAPSULATES HANDING OF Nulls BY wrapING ALL MEMBERS AS NEEDED
    ENCAPSULATES FLAT SLICES ([::]) FOR USE IN WINDOW FUNCTIONS
    https://github.com/klahnakoski/mo-dots/tree/dev/docs#flatlist-is-flat
    """

    EMPTY = None

    def __init__(self, vals=None):
        """ USE THE vals, NOT A COPY """
        # list.__init__(self)
        if vals == None:
            self.list = []
        elif vals.__class__ is FlatList:
            self.list = vals.list
        else:
            self.list = vals

    def __getitem__(self, index):
        if _get(index, CLASS) is slice:
            # IMPLEMENT FLAT SLICES (for i not in range(0, len(self)): assert self[i]==None)
            if index.step is not None:
                if not Log:
                    _late_import()
                Log.error(
                    "slice step must be None, do not know how to deal with values"
                )
            length = len(_get_list(self))

            i = index.start
            if i is None:
                i = 0
            else:
                i = min(max(i, 0), length)
            j = index.stop
            if j is None:
                j = length
            else:
                j = max(min(j, length), 0)
            return FlatList(_get_list(self)[i:j])

        if not isinstance(index, int) or index < 0 or len(_get_list(self)) <= index:
            return Null
        return to_data(_get_list(self)[index])

    def __setitem__(self, i, y):
        try:
            _list = _get_list(self)
            if i <= len(_list):
                for i in range(len(_list), i):
                    _list.append(None)
            _list[i] = from_data(y)
        except Exception as e:
            if not Log:
                _late_import()
            Log.error("problem", cause=e)

    def __getattr__(self, key):
        if key in ["__json__", "__call__"]:
            raise AttributeError()
        return self.get(key)

    def get(self, key):
        """
        simple `select`
        """
        if not Log:
            _late_import()

        return FlatList(
            vals=[
                from_data(coalesce(_datawrap(v), Null)[key])
                for v in _get_list(self)
            ]
        )

    def select(self, key):
        if not Log:
            _late_import()
        Log.error("Not supported.  Use `get()`")

    def filter(self, _filter):
        return FlatList(
            vals=[from_data(u) for u in (to_data(v) for v in _get_list(self)) if _filter(u)]
        )

    def __delslice__(self, i, j):
        if not Log:
            _late_import()
        Log.error(
            "Can not perform del on slice: modulo arithmetic was performed on the parameters.  You can try using clear()"
        )

    def __clear__(self):
        self.list = []

    def __iter__(self):
        temp = [to_data(v) for v in _get_list(self)]
        return iter(temp)

    def __contains__(self, item):
        return list.__contains__(_get_list(self), item)

    def append(self, val):
        _get_list(self).append(from_data(val))
        return self

    def __str__(self):
        return _get_list(self).__str__()

    def __len__(self):
        return _get_list(self).__len__()

    def __getslice__(self, i, j):
        global _emit_slice_warning

        if _emit_slice_warning:
            _emit_slice_warning = False
            if not Log:
                _late_import()
            Log.warning(
                "slicing is broken in Python 2.7: a[i:j] == a[i+len(a), j] sometimes. Use [start:stop:step] (see "
                "https://github.com/klahnakoski/mo-dots/tree/dev/docs#the-slice-operator-in-python27-is-inconsistent"
                ")"
            )
        return self[i:j:]

    def __list__(self):
        return self.list

    def copy(self):
        return FlatList(list(_get_list(self)))

    def __copy__(self):
        return FlatList(list(_get_list(self)))

    def __deepcopy__(self, memo):
        d = _get_list(self)
        return to_data(deepcopy(d, memo))

    def remove(self, x):
        _get_list(self).remove(x)
        return self

    def extend(self, values):
        lst = _get_list(self)
        for v in values:
            lst.append(from_data(v))
        return self

    def pop(self, index=None):
        if index is None:
            return to_data(_get_list(self).pop())
        else:
            return to_data(_get_list(self).pop(index))

    def __eq__(self, other):
        lst = _get_list(self)
        if other == None and len(lst) == 0:
            return True
        other_class = _get(other, CLASS)
        if other_class is FlatList:
            other = _get_list(other)
        try:
            if len(lst) != len(other):
                return False
            return all([s == o for s, o in zip(lst, other)])
        except Exception:
            return False

    def __add__(self, value):
        if value == None:
            return self
        output = list(_get_list(self))
        output.extend(value)
        return FlatList(vals=output)

    def __or__(self, value):
        output = list(_get_list(self))
        output.append(value)
        return FlatList(vals=output)

    def __radd__(self, other):
        output = list(other)
        output.extend(_get_list(self))
        return FlatList(vals=output)

    def __iadd__(self, other):
        if is_list(other):
            self.extend(other)
        else:
            self.append(other)
        return self

    def right(self, num=None):
        """
        WITH SLICES BEING FLAT, WE NEED A SIMPLE WAY TO SLICE FROM THE RIGHT [-num:]
        """
        if num == None:
            return self
        if num <= 0:
            return Null

        return FlatList(_get_list(self)[-num:])

    def limit(self, num=None):
        """
        NOT REQUIRED, BUT EXISTS AS OPPOSITE OF right()
        """
        if num == None:
            return self
        if num <= 0:
            return Null

        return FlatList(_get_list(self)[:num])

    def not_right(self, num):
        """
        WITH SLICES BEING FLAT, WE NEED A SIMPLE WAY TO SLICE FROM THE LEFT [:-num:]
        """
        if num == None:
            return self
        if num <= 0:
            return EMPTY

        return FlatList(_get_list(self)[:-num:])

    def not_left(self, num):
        """
        NOT REQUIRED, EXISTS AS OPPOSITE OF not_right()
        """
        if num == None:
            return self
        if num <= 0:
            return self

        return FlatList(_get_list(self)[num::])

    def last(self):
        """
        RETURN LAST ELEMENT IN FlatList [-1]
        """
        lst = _get_list(self)
        if lst:
            return to_data(lst[-1])
        return Null

    def map(self, oper, includeNone=True):
        if includeNone:
            return FlatList([oper(v) for v in _get_list(self)])
        else:
            return FlatList([oper(v) for v in _get_list(self) if v != None])


def last(values):
    if is_many(values):
        if not values:
            return Null
        if isinstance(values, FlatList):
            return values.last()
        elif is_list(values):
            if not values:
                return Null
            return values[-1]
        elif is_sequence(values):
            l = Null
            for i in values:
                l = i
            return l
        else:
            return first(values)

    return values


EMPTY = Null

list_types = (list, FlatList)
container_types = (list, FlatList, set)
sequence_types = (list, FlatList, tuple) + generator_types
many_types = tuple(set(list_types + container_types + sequence_types))

not_many_names = ("str", "unicode", "binary", "NullType", "NoneType", "dict", "Data")  # ITERATORS THAT ARE CONSIDERED PRIMITIVE


def is_list(l):
    # ORDERED, AND CAN CHANGE CONTENTS
    return l.__class__ in list_types


def is_container(l):
    # CAN ADD AND REMOVE ELEMENTS
    return l.__class__ in container_types


def is_sequence(l):
    # HAS AN ORDER, INCLUDES GENERATORS
    return l.__class__ in sequence_types


def is_many(value):
    # REPRESENTS MULTIPLE VALUES
    # TODO: CLEAN UP THIS LOGIC
    # THIS IS COMPLICATED BECAUSE I AM UNSURE ABOUT ALL THE "PRIMITIVE TYPES"
    # I WOULD LIKE TO POSITIVELY CATCH many_types, BUT MAYBE IT IS EASIER TO DETECT: Iterable, BUT NOT PRIMITIVE
    # UNTIL WE HAVE A COMPLETE LIST, WE KEEP ALL THIS warning() CODE
    global many_types
    type_ = value.__class__
    if type_ in many_types:
        return True

    if issubclass(type_, types.GeneratorType):
        if not Log:
            _late_import()
        many_types = many_types + (type_,)
        Log.warning("is_many() can not detect generator {{type}}", type=type_.__name__)
        return True
    return False
