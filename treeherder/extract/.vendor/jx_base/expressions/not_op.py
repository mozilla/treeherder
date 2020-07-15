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

from jx_base.expressions import and_op, exists_op, expression
from jx_base.expressions._utils import simplified
from jx_base.expressions.expression import Expression
from jx_base.language import is_op
from mo_json import BOOLEAN


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

    def invert(self):
        return self.lang[self.term].partial_eval()

    @simplified
    def partial_eval(self):
        return self.term.invert()


and_op.NotOp = NotOp
exists_op.NotOp = NotOp
expression.NotOp = NotOp
