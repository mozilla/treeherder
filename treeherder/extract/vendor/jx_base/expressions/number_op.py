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
from jx_base.expressions.case_op import CaseOp
from jx_base.expressions.coalesce_op import CoalesceOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.first_op import FirstOp
from jx_base.expressions.literal import Literal, ZERO, ONE
from jx_base.expressions.literal import is_literal
from jx_base.expressions.null_op import NULL
from jx_base.expressions.true_op import TRUE
from jx_base.expressions.when_op import WhenOp
from jx_base.language import is_op
from mo_future import text
from mo_json import NUMBER
from mo_logs import Log


class NumberOp(Expression):
    data_type = NUMBER

    def __init__(self, term):
        Expression.__init__(self, [term])
        self.term = term

    def __data__(self):
        return {"number": self.term.__data__()}

    def vars(self):
        return self.term.vars()

    def map(self, map_):
        return self.lang[NumberOp(self.term.map(map_))]

    def missing(self):
        return self.term.missing()

    @simplified
    def partial_eval(self):
        term = self.lang[FirstOp(self.term)].partial_eval()

        if is_literal(term):
            if term is NULL:
                return NULL
            elif term is FALSE:
                return ZERO
            elif term is TRUE:
                return ONE
            elif isinstance(term.value, text):
                return Literal(float(text))
            elif isinstance(term.value, (int, float)):
                return term
            else:
                Log.error("can not convert {{value|json}} to number", value=term.value)
        elif is_op(term, CaseOp):  # REWRITING
            return self.lang[
                CaseOp(
                    [
                        WhenOp(t.when, **{"then": NumberOp(t.then)})
                        for t in term.whens[:-1]
                    ]
                    + [NumberOp(term.whens[-1])]
                )
            ].partial_eval()
        elif is_op(term, WhenOp):  # REWRITING
            return self.lang[
                WhenOp(
                    term.when,
                    **{"then": NumberOp(term.then), "else": NumberOp(term.els_)}
                )
            ].partial_eval()
        elif is_op(term, CoalesceOp):
            return self.lang[CoalesceOp([NumberOp(t) for t in term.terms])]
        return self.lang[NumberOp(term)]
