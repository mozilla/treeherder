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

from jx_base.expressions import _utils, expression
from jx_base.expressions._utils import simplified, value2json
from jx_base.expressions.expression import Expression
from mo_dots import Null, is_data
from mo_json import python_type_to_json_type

DateOp, FALSE, TRUE, NULL = [None]*4


class Literal(Expression):
    """
    A literal JSON document
    """

    def __new__(cls, term):
        if term == None:
            return NULL
        if term is True:
            return TRUE
        if term is False:
            return FALSE
        if is_data(term) and term.get("date"):
            # SPECIAL CASE
            return cls.lang[DateOp(term.get("date"))]
        return object.__new__(cls)

    def __init__(self, value):
        Expression.__init__(self, None)
        self.simplified = True
        self._value = value

    @classmethod
    def define(cls, expr):
        return Literal(expr.get("literal"))

    def __nonzero__(self):
        return True

    def __eq__(self, other):
        if other == None:
            if self._value == None:
                return True
            else:
                return False
        elif self._value == None:
            return False

        if is_literal(other):
            return (self._value == other._value) or (self.json == other.json)

    def __data__(self):
        return {"literal": self.value}

    @property
    def value(self):
        return self._value

    @property
    def json(self):
        if self._value == "":
            self._json = '""'
        else:
            self._json = value2json(self._value)

        return self._json

    def vars(self):
        return set()

    def map(self, map_):
        return self

    def missing(self):
        if self._value in [None, Null]:
            return TRUE
        if self.value == "":
            return TRUE
        return FALSE

    def invert(self):
        return self.missing()

    def __call__(self, row=None, rownum=None, rows=None):
        return self.value

    def __unicode__(self):
        return self._json

    def __str__(self):
        return str(self._json)

    @property
    def type(self):
        return python_type_to_json_type[self._value.__class__]

    @simplified
    def partial_eval(self):
        return self

    def str(self):
        return str(self.value)


ZERO = Literal(0)
ONE = Literal(1)


literal_op_ids = tuple()


def register_literal(op):
    global literal_op_ids
    literal_op_ids = literal_op_ids+(op.get_id(),)


def is_literal(l):
    try:
        return l.get_id() in literal_op_ids
    except Exception:
        return False


_utils.Literal = Literal
expression.Literal = Literal
expression.is_literal=is_literal
