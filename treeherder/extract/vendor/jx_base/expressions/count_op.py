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

from jx_base.expressions.false_op import FALSE
from jx_base.expressions.expression import Expression
from jx_base.expressions.true_op import TrueOp
from jx_base.expressions.tuple_op import TupleOp
from mo_dots import is_many
from mo_json import INTEGER


class CountOp(Expression):
    has_simple_form = False
    data_type = INTEGER

    def __init__(self, terms, **clauses):
        Expression.__init__(self, terms)
        if is_many(terms):
            # SHORTCUT: ASSUME AN ARRAY OF IS A TUPLE
            self.terms = self.lang[TupleOp(terms)]
        else:
            self.terms = terms

    def __data__(self):
        return {"count": self.terms.__data__()}

    def vars(self):
        return self.terms.vars()

    def map(self, map_):
        return self.lang[CountOp(self.terms.map(map_))]

    def missing(self):
        return FALSE

    def exists(self):
        return TrueOp
