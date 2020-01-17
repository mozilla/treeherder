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

import re

from jx_base.expressions._utils import simplified
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import Literal, is_literal
from jx_base.expressions.reg_exp_op import RegExpOp
from jx_base.expressions.true_op import TRUE
from jx_base.expressions.variable import Variable
from jx_base.expressions.when_op import WhenOp
from jx_base.language import is_op
from mo_dots import is_data
from mo_json import BOOLEAN, STRING
from mo_logs import Log


class SuffixOp(Expression):
    has_simple_form = True
    data_type = BOOLEAN

    def __init__(self, term):
        Expression.__init__(self, term)
        if not term:
            self.expr = self.suffix = None
        elif is_data(term):
            self.expr, self.suffix = term.items()[0]
        else:
            self.expr, self.suffix = term

    def __data__(self):
        if self.expr is None:
            return {"suffix": {}}
        elif is_op(self.expr, Variable) and is_literal(self.suffix):
            return {"suffix": {self.expr.var: self.suffix.value}}
        else:
            return {"suffix": [self.expr.__data__(), self.suffix.__data__()]}

    def missing(self):
        """
        THERE IS PLENTY OF OPPORTUNITY TO SIMPLIFY missing EXPRESSIONS
        OVERRIDE THIS METHOD TO SIMPLIFY
        :return:
        """
        return FALSE

    def vars(self):
        if self.expr is None:
            return set()
        return self.expr.vars() | self.suffix.vars()

    def map(self, map_):
        if self.expr is None:
            return TRUE
        else:
            return self.lang[SuffixOp([self.expr.map(map_), self.suffix.map(map_)])]

    @simplified
    def partial_eval(self):
        if self.expr is None:
            return TRUE
        if not is_literal(self.suffix) and self.suffix.type == STRING:
            Log.error("can only hanlde literal suffix ")

        return WhenOp(
            self.lang[AndOp([self.expr.exists(), self.suffix.exists()])],
            **{
                "then": self.lang[
                    RegExpOp([self.expr, Literal(".*" + re.escape(self.suffix.value))])
                ],
                "else": FALSE,
            }
        ).partial_eval()
