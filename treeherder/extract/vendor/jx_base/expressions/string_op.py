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

import mo_json
from jx_base.expressions._utils import simplified
from jx_base.expressions.coalesce_op import CoalesceOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.first_op import FirstOp
from jx_base.expressions.literal import Literal
from jx_base.expressions.literal import is_literal
from jx_base.expressions.null_op import NULL
from jx_base.language import is_op
from mo_json import STRING, IS_NULL


class StringOp(Expression):
    data_type = STRING

    def __init__(self, term):
        Expression.__init__(self, [term])
        self.term = term

    def __data__(self):
        return {"string": self.term.__data__()}

    def vars(self):
        return self.term.vars()

    def map(self, map_):
        return self.lang[StringOp(self.term.map(map_))]

    def missing(self):
        return self.term.missing()

    @simplified
    def partial_eval(self):
        term = self.term
        if term.type is IS_NULL:
            return NULL
        term = self.lang[FirstOp(term)].partial_eval()
        if is_op(term, StringOp):
            return term.term.partial_eval()
        elif is_op(term, CoalesceOp):
            return self.lang[
                CoalesceOp([self.lang[StringOp(t)].partial_eval() for t in term.terms])
            ]
        elif is_literal(term):
            if term.type == STRING:
                return term
            else:
                return self.lang[Literal(mo_json.value2json(term.value))]
        return self

    def __eq__(self, other):
        if not is_op(other, StringOp):
            return False
        return self.term == other.term
