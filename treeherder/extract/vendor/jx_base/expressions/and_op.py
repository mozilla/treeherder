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
from jx_base.expressions.boolean_op import BooleanOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.true_op import TRUE
from jx_base.language import is_op
from mo_dots import is_many
from mo_future import zip_longest
from mo_json import BOOLEAN

NotOp = None
OrOp = None

class AndOp(Expression):
    data_type = BOOLEAN

    def __init__(self, terms):
        Expression.__init__(self, terms)
        if terms == None:
            self.terms = []
        elif is_many(terms):
            self.terms = terms
        else:
            self.terms = [terms]

    def __data__(self):
        return {"and": [t.__data__() for t in self.terms]}

    def __eq__(self, other):
        if is_op(other, AndOp):
            return all(a == b for a, b in zip_longest(self.terms, other.terms))
        return False

    def vars(self):
        output = set()
        for t in self.terms:
            output |= t.vars()
        return output

    def map(self, map_):
        return self.lang[AndOp([t.map(map_) for t in self.terms])]

    def missing(self):
        return FALSE

    @simplified
    def partial_eval(self):
        or_terms = [[]]  # LIST OF TUPLES FOR or-ing and and-ing
        for i, t in enumerate(self.terms):
            simple = self.lang[BooleanOp(t)].partial_eval()
            if simple.type != BOOLEAN:
                simple = simple.exists()

            if simple is self.lang[TRUE]:
                continue
            elif simple is FALSE:
                return FALSE
            elif is_op(simple, AndOp):
                for and_terms in or_terms:
                    and_terms.extend([tt for tt in simple.terms if tt not in and_terms])
                continue
            elif is_op(simple, OrOp):
                or_terms = [
                    and_terms + ([o] if o not in and_terms else [])
                    for o in simple.terms
                    for and_terms in or_terms
                    if self.lang[NotOp(o)].partial_eval() not in and_terms
                ]
                continue
            for and_terms in list(or_terms):
                if self.lang[NotOp(simple)].partial_eval() in and_terms:
                    or_terms.remove(and_terms)
                elif simple not in and_terms:
                    and_terms.append(simple)

        if len(or_terms) == 0:
            return FALSE
        elif len(or_terms) == 1:
            and_terms = or_terms[0]
            if len(and_terms) == 0:
                return TRUE
            elif len(and_terms) == 1:
                return and_terms[0]
            else:
                return self.lang[AndOp(and_terms)]

        return self.lang[
            OrOp(
                [
                    AndOp(and_terms) if len(and_terms) > 1 else and_terms[0]
                    for and_terms in or_terms
                ]
            )
        ].partial_eval()
