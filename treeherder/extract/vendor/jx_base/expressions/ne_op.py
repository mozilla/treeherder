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

from jx_base.expressions import not_op
from jx_base.expressions._utils import simplified
from jx_base.expressions.eq_op import EqOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import is_literal
from jx_base.expressions.not_op import NotOp
from jx_base.expressions.variable import Variable
from jx_base.language import is_op
from mo_dots import is_data, is_sequence
from mo_json import BOOLEAN
from mo_logs import Log


class NeOp(Expression):
    has_simple_form = True
    data_type = BOOLEAN

    def __init__(self, terms):
        Expression.__init__(self, terms)
        if is_sequence(terms):
            self.lhs, self.rhs = terms
        elif is_data(terms):
            self.rhs, self.lhs = terms.items()[0]
        else:
            Log.error("logic error")

    def __data__(self):
        if is_op(self.lhs, Variable) and is_literal(self.rhs):
            return {"ne": {self.lhs.var, self.rhs.value}}
        else:
            return {"ne": [self.lhs.__data__(), self.rhs.__data__()]}

    def vars(self):
        return self.lhs.vars() | self.rhs.vars()

    def map(self, map_):
        return self.lang[NeOp([self.lhs.map(map_), self.rhs.map(map_)])]

    def missing(self):
        return (
            FALSE
        )  # USING THE decisive EQUAILTY https://github.com/mozilla/jx-sqlite/blob/master/docs/Logical%20Equality.md#definitions

    @simplified
    def partial_eval(self):
        output = self.lang[NotOp(EqOp([self.lhs, self.rhs]))].partial_eval()
        return output

not_op.NeOp = NeOp