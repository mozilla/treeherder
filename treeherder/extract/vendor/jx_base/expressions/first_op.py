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
from jx_base.expressions.expression import Expression
from jx_base.expressions.last_op import LastOp
from jx_base.expressions.literal import is_literal
from jx_base.language import is_op
from mo_json import OBJECT
from mo_logs import Log

CaseOp = None
WhenOp = None


class FirstOp(Expression):
    def __init__(self, term):
        Expression.__init__(self, [term])
        self.term = term
        self.data_type = self.term.type

    def __data__(self):
        return {"first": self.term.__data__()}

    def vars(self):
        return self.term.vars()

    def map(self, map_):
        return self.lang[LastOp(self.term.map(map_))]

    def missing(self):
        return self.term.missing()

    @simplified
    def partial_eval(self):
        term = self.lang[self.term].partial_eval()
        if is_op(term, FirstOp):
            return term
        elif is_op(term, CaseOp):  # REWRITING
            return self.lang[
                CaseOp(
                    [
                        WhenOp(t.when, **{"then": FirstOp(t.then)})
                        for t in term.whens[:-1]
                    ]
                    + [FirstOp(term.whens[-1])]
                )
            ].partial_eval()
        elif is_op(term, WhenOp):
            return self.lang[
                WhenOp(
                    term.when,
                    **{"then": FirstOp(term.then), "else": FirstOp(term.els_)}
                )
            ].partial_eval()
        elif term.type != OBJECT and not term.many:
            return term
        elif is_literal(term):
            Log.error("not handled yet")
        else:
            return self.lang[FirstOp(term)]
