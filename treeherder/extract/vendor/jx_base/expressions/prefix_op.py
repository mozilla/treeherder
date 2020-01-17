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
from jx_base.expressions.basic_starts_with_op import BasicStartsWithOp
from jx_base.expressions.case_op import CaseOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import is_literal
from jx_base.expressions.null_op import NULL
from jx_base.expressions.true_op import TRUE
from jx_base.expressions.variable import Variable
from jx_base.expressions.when_op import WhenOp
from jx_base.language import is_op
from mo_dots import is_data
from mo_json import BOOLEAN


class PrefixOp(Expression):
    has_simple_form = True
    data_type = BOOLEAN

    def __init__(self, term):
        Expression.__init__(self, term)
        if not term:
            self.expr = NULL
            self.prefix = NULL
        elif is_data(term):
            self.expr, self.prefix = term.items()[0]
        else:
            self.expr, self.prefix = term

    def __data__(self):
        if not self.expr:
            return {"prefix": {}}
        elif is_op(self.expr, Variable) and is_literal(self.prefix):
            return {"prefix": {self.expr.var: self.prefix.value}}
        else:
            return {"prefix": [self.expr.__data__(), self.prefix.__data__()]}

    def vars(self):
        if self.expr is NULL:
            return set()
        return self.expr.vars() | self.prefix.vars()

    def map(self, map_):
        if not self.expr:
            return self
        else:
            return self.lang[PrefixOp([self.expr.map(map_), self.prefix.map(map_)])]

    def missing(self):
        return FALSE

    @simplified
    def partial_eval(self):
        return self.lang[
            CaseOp(
                [
                    WhenOp(self.prefix.missing(), then=TRUE),
                    WhenOp(self.expr.missing(), then=FALSE),
                    BasicStartsWithOp([self.expr, self.prefix]),
                ]
            )
        ].partial_eval()

    def __eq__(self, other):
        if not is_op(other, PrefixOp):
            return False
        return self.expr == other.expr and self.prefix == other.prefix
