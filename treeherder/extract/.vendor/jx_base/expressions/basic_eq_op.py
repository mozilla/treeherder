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

from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.language import is_op
from mo_json import BOOLEAN


class BasicEqOp(Expression):
    """
    PLACEHOLDER FOR BASIC `==` OPERATOR (CAN NOT DEAL WITH NULLS)
    """

    data_type = BOOLEAN

    def __init__(self, terms):
        Expression.__init__(self, terms)
        self.lhs, self.rhs = terms

    def __data__(self):
        return {"basic.eq": [self.lhs.__data__(), self.rhs.__data__()]}

    def missing(self):
        return FALSE

    def __eq__(self, other):
        if not is_op(other, BasicEqOp):
            return False
        return self.lhs == other.lhs and self.rhs == other.rhs
