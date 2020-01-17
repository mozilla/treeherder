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

from copy import copy
from decimal import Decimal
from math import isnan

from mo_dots import Data, data_types, listwrap, NullType, startswith_field
from mo_dots.lists import list_types, is_many
from mo_future import boolean_type, long, none_type, text, transpose
from mo_logs import Log
from mo_times import Date

builtin_tuple = tuple

Expression = None
expression_module = "jx_base.expressions"
JX = None
ID = "_op_id"

_next_id = 0


def next_id():
    global _next_id
    try:
        return _next_id
    finally:
        _next_id+=1


def all_bases(bases):
    for b in bases:
        yield b
        for y in all_bases(b.__bases__):
            yield y


# EVERY OPERATOR WILL HAVE lang WHICH POINTS TO LANGUAGE
class LanguageElement(type):
    def __new__(cls, name, bases, dct):
        x = type.__new__(cls, name, bases, dct)
        x.lang = None
        if startswith_field(x.__module__, expression_module):
            # ALL OPS IN expression_module ARE GIVEN AN ID, NO OTHERS
            setattr(x, ID, next_id())
        return x

    def __init__(cls, *args):
        global Expression, expression_module
        type.__init__(cls, *args)
        if not expression_module and cls.__name__ == "Expression":
            # THE expression_module IS DETERMINED BY THE LOCATION OF Expression CLASS
            Expression = cls
            expression_module = cls.__module__


BaseExpression = LanguageElement(str("BaseExpression"), (object,), {})


class Language(object):

    def __init__(self, name):
        global JX
        if not name:
            name = "JX"
            JX = self
        self.name = name
        self.ops = None

    def register_ops(self, module_vars):
        global JX

        if self.name != "JX":
            self.ops = copy(JX.ops)
        else:
            num_ops = 1 + max(
                obj.get_id()
                for obj in module_vars.values()
                if isinstance(obj, type) and hasattr(obj, ID)
            )
            self.ops = [None] * num_ops

        for _, new_op in module_vars.items():
            if isinstance(new_op, type) and hasattr(new_op, ID):
                # EXPECT OPERATORS TO HAVE id
                # EXPECT NEW DEFINED OPS IN THIS MODULE TO HAVE lang NOT SET
                curr = getattr(new_op, "lang")
                if not curr:
                    old_op = self.ops[new_op.get_id()]
                    if old_op is not None and old_op.__name__ != new_op.__name__:
                        Log.error("Logic error")
                    self.ops[new_op.get_id()] = new_op
                    setattr(new_op, "lang", self)

        if self.name:
            # ENSURE THE ALL OPS ARE DEFINED ON THE NEW LANGUAGE
            for base_op, new_op in transpose(JX.ops, self.ops):
                if new_op is base_op:
                    # MISSED DEFINITION, ADD ONE
                    new_op = type(base_op.__name__, (base_op,), {})
                    self.ops[new_op.get_id()] = new_op
                    setattr(new_op, "lang", self)

    def __getitem__(self, item):
        if item == None:
            Log.error("expecting operator")
        class_ = self.ops[item.get_id()]
        if class_.__name__ != item.__class__.__name__:
            Log.error("programming error")
        item.__class__ = class_
        return item

    def __str__(self):
        return self.name


def is_op(call, op):
    """
    :param call: The specific operator instance (a method call)
    :param op: The the operator we are testing against
    :return: isinstance(call, op), but faster
    """
    try:
        return call.get_id() == op.get_id()
    except Exception as e:
        return False


def is_expression(call):
    if is_many(call):
        return False
    try:
        output = getattr(call, ID, None) != None
    except Exception:
        output = False
    # if output != isinstance(call, Expression):
    #     Log.error("programmer error")
    return output


def value_compare(left, right, ordering=1):
    """
    SORT VALUES, NULL IS THE LEAST VALUE
    :param left: LHS
    :param right: RHS
    :param ordering: (-1, 0, 1) TO AFFECT SORT ORDER
    :return: The return value is negative if x < y, zero if x == y and strictly positive if x > y.
    """

    try:
        ltype = left.__class__
        rtype = right.__class__

        if ltype in list_types or rtype in list_types:
            if left == None:
                return ordering
            elif right == None:
                return - ordering

            left = listwrap(left)
            right = listwrap(right)
            for a, b in zip(left, right):
                c = value_compare(a, b) * ordering
                if c != 0:
                    return c

            if len(left) < len(right):
                return - ordering
            elif len(left) > len(right):
                return ordering
            else:
                return 0

        if ltype is float and isnan(left):
            left = None
            ltype = none_type
        if rtype is float and isnan(right):
            right = None
            rtype = none_type

        ltype_num = type_order(ltype, ordering)
        rtype_num = type_order(rtype, ordering)

        type_diff = ltype_num - rtype_num
        if type_diff != 0:
            return ordering if type_diff > 0 else -ordering

        if ltype_num in (-10, 10):
            return 0
        elif ltype is builtin_tuple:
            for a, b in zip(left, right):
                c = value_compare(a, b)
                if c != 0:
                    return c * ordering
            return 0
        elif ltype in data_types:
            for k in sorted(set(left.keys()) | set(right.keys())):
                c = value_compare(left.get(k), right.get(k)) * ordering
                if c != 0:
                    return c
            return 0
        elif left > right:
            return ordering
        elif left < right:
            return -ordering
        else:
            return 0
    except Exception as e:
        Log.error("Can not compare values {{left}} to {{right}}", left=left, right=right, cause=e)


def type_order(dtype, ordering):
    o = TYPE_ORDER.get(dtype)
    if o is None:
        if dtype in NULL_TYPES:
            return ordering * 10
        else:
            Log.warning("type will be treated as its own type while sorting")
            TYPE_ORDER[dtype] = 6
            return 6
    return o


NULL_TYPES = (none_type, NullType)


TYPE_ORDER = {
    boolean_type: 0,
    int: 1,
    float: 1,
    Decimal: 1,
    Date: 1,
    long: 1,
    text: 3,
    list: 4,
    builtin_tuple: 4,
    dict: 5,
    Data: 5
}



