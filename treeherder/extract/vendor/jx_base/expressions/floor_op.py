# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http:# mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#

"""
# NOTE:

THE self.lang[operator] PATTERN IS CASTING NEW OPERATORS TO OWN LANGUAGE;
KEEPING Python AS# Python, ES FILTERS AS ES FILTERS, AND Painless AS
Painless. WE COULD COPY partial_eval(), AND OTHERS, TO THIER RESPECTIVE
LANGUAGE, BUT WE KEEP CODE HERE SO THERE IS LESS OF IT

"""
from __future__ import absolute_import, division, unicode_literals

from jx_base.expressions.eq_op import EqOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import ZERO, ONE
from jx_base.expressions.literal import is_literal
from jx_base.expressions.null_op import NULL
from jx_base.expressions.or_op import OrOp
from jx_base.expressions.variable import Variable
from jx_base.language import is_op
from mo_json import NUMBER


class FloorOp(Expression):
    has_simple_form = True
    data_type = NUMBER

    def __init__(self, terms, default=NULL):
        Expression.__init__(self, terms)
        if len(terms) == 1:
            self.lhs = terms[0]
            self.rhs = ONE
        else:
            self.lhs, self.rhs = terms
        self.default = default

    def __data__(self):
        if is_op(self.lhs, Variable) and is_literal(self.rhs):
            return {"floor": {self.lhs.var, self.rhs.value}, "default": self.default}
        else:
            return {
                "floor": [self.lhs.__data__(), self.rhs.__data__()],
                "default": self.default,
            }

    def vars(self):
        return self.lhs.vars() | self.rhs.vars() | self.default.vars()

    def map(self, map_):
        return self.lang[
            FloorOp(
                [self.lhs.map(map_), self.rhs.map(map_)], default=self.default.map(map_)
            )
        ]

    def missing(self):
        if self.default.exists():
            return FALSE
        else:
            return self.lang[
                OrOp([self.lhs.missing(), self.rhs.missing(), EqOp([self.rhs, ZERO])])
            ]
