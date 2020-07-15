# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http:# mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#

from __future__ import absolute_import, division, unicode_literals

import operator

from jx_base.language import is_expression, Language
from mo_dots import Null, is_sequence
from mo_future import (
    first,
    get_function_name,
    is_text,
    items as items_,
    text,
    utf8_json_encoder,
)
from mo_json import BOOLEAN, INTEGER, IS_NULL, NUMBER, OBJECT, STRING, scrub
from mo_logs import Except, Log
from mo_math import is_number
from mo_times import Date

ALLOW_SCRIPTING = False
EMPTY_DICT = {}

Literal, TRUE, NULL, TupleOp, Variable = [Null] * 5  # IMPORTS

def extend(cls):
    """
    DECORATOR TO ADD METHODS TO CLASSES
    :param cls: THE CLASS TO ADD THE METHOD TO
    :return:
    """

    def extender(func):
        setattr(cls, get_function_name(func), func)
        return func

    return extender


def simplified(func):
    def mark_as_simple(self):
        if self.simplified:
            return self

        output = func(self)
        output.simplified = True
        return output

    func_name = get_function_name(func)
    mark_as_simple.__name__ = func_name
    return mark_as_simple


def jx_expression(expr, schema=None):
    if expr == None:
        return None

    # UPDATE THE VARIABLE WITH THIER KNOWN TYPES
    if not schema:
        output = _jx_expression(expr, language)
        return output
    output = _jx_expression(expr, language)
    for v in output.vars():
        leaves = schema.leaves(v.var)
        if len(leaves) == 0:
            v.data_type = IS_NULL
        if len(leaves) == 1:
            v.data_type = first(leaves).jx_type
    return output


def _jx_expression(expr, lang):
    """
    WRAP A JSON EXPRESSION WITH OBJECT REPRESENTATION
    """
    if is_expression(expr):
        # CONVERT TO lang
        new_op = lang[expr]
        if not new_op:
            # CAN NOT BE FOUND, TRY SOME PARTIAL EVAL
            return language[expr.get_id()].partial_eval()
        return expr
        # return new_op(expr.args)  # THIS CAN BE DONE, BUT IT NEEDS MORE CODING, AND I WOULD EXPECT IT TO BE SLOW

    if expr is None:
        return TRUE
    elif is_text(expr):
        return Variable(expr)
    elif expr in (True, False, None) or expr == None or is_number(expr):
        return Literal(expr)
    elif expr.__class__ is Date:
        return Literal(expr.unix)
    elif is_sequence(expr):
        return lang[TupleOp([_jx_expression(e, lang) for e in expr])]

    # expr = to_data(expr)
    try:
        items = items_(expr)

        for op, term in items:
            # ONE OF THESE IS THE OPERATOR
            full_op = operators.get(op)
            if full_op:
                class_ = lang.ops[full_op.get_id()]
                if class_:
                    return class_.define(expr)

                # THIS LANGUAGE DOES NOT SUPPORT THIS OPERATOR, GOTO BASE LANGUAGE AND GET THE MACRO
                class_ = language[op.get_id()]
                output = class_.define(expr).partial_eval()
                return _jx_expression(output, lang)
        else:
            if not items:
                return NULL
            raise Log.error("{{instruction|json}} is not known", instruction=expr)

    except Exception as e:
        Log.error("programmer error expr = {{value|quote}}", value=expr, cause=e)


language = Language(None)


_json_encoder = utf8_json_encoder


def value2json(value):
    try:
        scrubbed = scrub(value, scrub_number=float)
        return text(_json_encoder(scrubbed))
    except Exception as e:
        e = Except.wrap(e)
        Log.warning("problem serializing {{type}}", type=text(repr(value)), cause=e)
        raise e


def merge_types(jx_types):
    """
    :param jx_types: ITERABLE OF jx TYPES
    :return: ONE TYPE TO RULE THEM ALL
    """
    return _merge_types[max(_merge_score[t] for t in jx_types)]


_merge_score = {IS_NULL: 0, BOOLEAN: 1, INTEGER: 2, NUMBER: 3, STRING: 4, OBJECT: 5}
_merge_types = {v: k for k, v in _merge_score.items()}

builtin_ops = {
    "ne": operator.ne,
    "eq": operator.eq,
    "gte": operator.ge,
    "gt": operator.gt,
    "lte": operator.le,
    "lt": operator.lt,
    "add": operator.add,
    "sub": operator.sub,
    "mul": operator.mul,
    "max": lambda *v: max(v),
    "min": lambda *v: min(v),
}

operators = {}
