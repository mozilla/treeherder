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
from jx_base.language import is_op
from mo_json import BOOLEAN


class EsNestedOp(Expression):
    data_type = BOOLEAN
    has_simple_form = False

    def __init__(self, terms):
        Expression.__init__(self, terms)
        self.path, self.query = terms

    @simplified
    def partial_eval(self):
        if self.path.var == ".":
            return self.query.partial_eval()
        return self.lang[
            EsNestedOp("es.nested", [self.path, self.query.partial_eval()])
        ]

    def __data__(self):
        return {"es.nested": {self.path.var: self.query.__data__()}}

    def __eq__(self, other):
        if is_op(other, EsNestedOp):
            return self.path.var == other.path.var and self.query == other.query
        return False
