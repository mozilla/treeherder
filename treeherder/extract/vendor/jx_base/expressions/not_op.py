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

from jx_base.expressions import and_op, exists_op, expression
from jx_base.expressions._utils import simplified
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.basic_index_of_op import BasicIndexOfOp
from jx_base.expressions.basic_substring_op import BasicSubstringOp
from jx_base.expressions.eq_op import EqOp
from jx_base.expressions.exists_op import ExistsOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import is_literal
from jx_base.expressions.missing_op import MissingOp
from jx_base.expressions.null_op import NULL
from jx_base.expressions.or_op import OrOp
from jx_base.expressions.true_op import TRUE
from jx_base.language import is_op
from mo_json import BOOLEAN
from mo_logs import Log

CaseOp = None
NeOp = None
WhenOp = None

class NotOp(Expression):
    data_type = BOOLEAN

    def __init__(self, term):
        Expression.__init__(self, term)
        self.term = term

    def __data__(self):
        return {"not": self.term.__data__()}

    def __eq__(self, other):
        if not is_op(other, NotOp):
            return False
        return self.term == other.term

    def vars(self):
        return self.term.vars()

    def map(self, map_):
        return self.lang[NotOp(self.term.map(map_))]

    def missing(self):
        return self.term.missing()

    @simplified
    def partial_eval(self):
        def inverse(term):
            if term is TRUE:
                return FALSE
            elif term is FALSE:
                return TRUE
            elif term is NULL:
                return TRUE
            elif is_literal(term):
                Log.error("`not` operator expects a Boolean term")
            elif is_op(term, WhenOp):
                output = self.lang[
                    WhenOp(
                        term.when,
                        **{"then": inverse(term.then), "else": inverse(term.els_)}
                    )
                ].partial_eval()
            elif is_op(term, CaseOp):  # REWRITING
                output = self.lang[
                    CaseOp(
                        [
                            WhenOp(w.when, **{"then": inverse(w.then)})
                            if is_op(w, WhenOp)
                            else inverse(w)
                            for w in term.whens
                        ]
                    )
                ].partial_eval()
            elif is_op(term, AndOp):
                output = self.lang[
                    OrOp([inverse(t) for t in term.terms])
                ].partial_eval()
            elif is_op(term, OrOp):
                output = self.lang[
                    AndOp([inverse(t) for t in term.terms])
                ].partial_eval()
            elif is_op(term, MissingOp):
                output = self.lang[NotOp(term.expr.missing())]
            elif is_op(term, ExistsOp):
                output = term.field.missing().partial_eval()
            elif is_op(term, NotOp):
                output = self.lang[term.term].partial_eval()
            elif is_op(term, NeOp):
                output = self.lang[EqOp([term.lhs, term.rhs])].partial_eval()
            elif is_op(term, BasicIndexOfOp) or is_op(term, BasicSubstringOp):
                return FALSE
            else:
                output = self.lang[NotOp(term)]

            return output

        output = inverse(self.lang[self.term].partial_eval())
        return output


and_op.NotOp = NotOp
exists_op.NotOp = NotOp
expression.NotOp =NotOp
