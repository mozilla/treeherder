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

from jx_base.expressions import first_op, eq_op
from jx_base.expressions._utils import simplified
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import NULL
from jx_base.expressions.not_op import NotOp
from jx_base.expressions.or_op import OrOp
from jx_base.expressions.true_op import TRUE
from jx_base.expressions.when_op import WhenOp
from jx_base.language import is_op
from mo_dots import is_sequence
from mo_future import first
from mo_json import OBJECT, BOOLEAN
from mo_logs import Log


class CaseOp(Expression):
    def __init__(self, terms, **clauses):
        if not is_sequence(terms):
            Log.error("case expression requires a list of `when` sub-clauses")
        Expression.__init__(self, terms)
        if len(terms) == 0:
            Log.error("Expecting at least one clause")

        for w in terms[:-1]:
            if not is_op(w, WhenOp) or w.els_ is not NULL:
                Log.error(
                    "case expression does not allow `else` clause in `when` sub-clause"
                )
        self.whens = terms

    def __data__(self):
        return {"case": [w.__data__() for w in self.whens]}

    def __eq__(self, other):
        if is_op(other, CaseOp):
            return all(s == o for s, o in zip(self.whens, other.whens))

    def vars(self):
        output = set()
        for w in self.whens:
            output |= w.vars()
        return output

    def map(self, map_):
        return self.lang[CaseOp([w.map(map_) for w in self.whens])]

    def missing(self):
        m = self.whens[-1].missing()
        for w in reversed(self.whens[0:-1]):
            when = w.when.partial_eval()
            if when is FALSE:
                pass
            elif when is TRUE:
                m = w.then.partial_eval().missing()
            else:
                m = self.lang[OrOp([AndOp([when, w.then.partial_eval().missing()]), m])]
        return m.partial_eval()

    def invert(self):
        return self.lang[CaseOp([w.invert() for w in self.whens])].partial_eval()

    @simplified
    def partial_eval(self):
        if self.type == BOOLEAN:
            nots = []
            ors = []
            for w in self.whens[:-1]:
                ors.append(AndOp(nots + [w.when, w.then]))
                nots.append(NotOp(w.when))
            ors.append(AndOp(nots + [self.whens[-1]]))
            return self.lang[OrOp(ors)].partial_eval()

        whens = []
        for w in self.whens[:-1]:
            when = self.lang[w.when].partial_eval()
            if when is TRUE:
                whens.append(self.lang[w.then].partial_eval())
                break
            elif when is FALSE:
                pass
            else:
                whens.append(self.lang[WhenOp(when, **{"then": w.then.partial_eval()})])
        else:
            whens.append(self.lang[self.whens[-1]].partial_eval())

        if len(whens) == 1:
            return whens[0]
        elif len(whens) == 2:
            return self.lang[WhenOp(whens[0].when, **{"then": whens[0].then, "else": whens[1]})]
        else:
            return self.lang[CaseOp(whens)]

    @property
    def type(self):
        types = set(w.then.type if is_op(w, WhenOp) else w.type for w in self.whens)
        if len(types) > 1:
            return OBJECT
        else:
            return first(types)


first_op.CaseOp = CaseOp
eq_op.CaseOp = CaseOp
