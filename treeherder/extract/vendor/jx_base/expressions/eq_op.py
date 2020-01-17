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

from jx_base.expressions._utils import simplified
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.basic_eq_op import BasicEqOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import is_literal
from jx_base.expressions.true_op import TRUE
from jx_base.expressions.variable import Variable
from jx_base.language import is_op, value_compare
from mo_dots import is_many
from mo_json import BOOLEAN

CaseOp = None
InOp = None
WhneOp = None

class EqOp(Expression):
    has_simple_form = True
    data_type = BOOLEAN

    def __new__(cls, terms):
        if is_many(terms):
            return object.__new__(cls)

        items = terms.items()
        if len(items) == 1:
            if is_many(items[0][1]):
                return cls.lang[InOp(items[0])]
            else:
                return cls.lang[EqOp(items[0])]
        else:
            acc = []
            for lhs, rhs in items:
                if rhs.json.startswith("["):
                    acc.append(cls.lang[InOp([Variable(lhs), rhs])])
                else:
                    acc.append(cls.lang[EqOp([Variable(lhs), rhs])])
            return cls.lang[AndOp(acc)]

    def __init__(self, terms):
        Expression.__init__(self, terms)
        self.lhs, self.rhs = terms

    def __data__(self):
        if is_op(self.lhs, Variable) and is_literal(self.rhs):
            return {"eq": {self.lhs.var, self.rhs.value}}
        else:
            return {"eq": [self.lhs.__data__(), self.rhs.__data__()]}

    def __eq__(self, other):
        if is_op(other, EqOp):
            return self.lhs == other.lhs and self.rhs == other.rhs
        return False

    def vars(self):
        return self.lhs.vars() | self.rhs.vars()

    def map(self, map_):
        return self.lang[EqOp([self.lhs.map(map_), self.rhs.map(map_)])]

    def missing(self):
        return FALSE

    def exists(self):
        return TRUE

    @simplified
    def partial_eval(self):
        lhs = self.lang[self.lhs].partial_eval()
        rhs = self.lang[self.rhs].partial_eval()

        if is_literal(lhs) and is_literal(rhs):
            return FALSE if value_compare(lhs.value, rhs.value) else TRUE
        else:
            return self.lang[
                self.lang[CaseOp(
                    [
                        WhenOp(lhs.missing(), **{"then": rhs.missing()}),
                        WhenOp(rhs.missing(), **{"then": FALSE}),
                        BasicEqOp([lhs, rhs]),
                    ]
                )]
            ].partial_eval()
