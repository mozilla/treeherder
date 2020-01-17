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

from jx_base.language import is_op

from jx_base.expressions._utils import simplified
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.integer_op import IntegerOp
from jx_base.expressions.literal import ZERO
from jx_base.expressions.max_op import MaxOp
from jx_base.expressions.string_op import StringOp
from mo_json import INTEGER


class BasicIndexOfOp(Expression):
    """
    PLACEHOLDER FOR BASIC value.indexOf(find, start) (CAN NOT DEAL WITH NULLS)
    """

    data_type = INTEGER

    def __init__(self, params):
        Expression.__init__(self, params)
        self.value, self.find, self.start = params

    def __data__(self):
        return {
            "basic.indexOf": [
                self.value.__data__(),
                self.find.__data__(),
                self.start.__data__(),
            ]
        }

    def vars(self):
        return self.value.vars() | self.find.vars() | self.start.vars()

    def missing(self):
        return FALSE

    @simplified
    def partial_eval(self):
        start = IntegerOp(MaxOp([ZERO, self.start])).partial_eval()
        return self.lang[
            BasicIndexOfOp(
                [
                    StringOp(self.value).partial_eval(),
                    StringOp(self.find).partial_eval(),
                    start,
                ]
            )
        ]

    def __eq__(self, other):
        if not is_op(other, BasicIndexOfOp):
            return False
        return self.value == self.value and self.find == other.find and self.start == other.start
