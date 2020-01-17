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

from jx_base.expressions._utils import simplified, builtin_ops
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.base_binary_op import BaseBinaryOp
from jx_base.expressions.eq_op import EqOp
from jx_base.expressions.literal import Literal, ZERO, is_literal
from jx_base.expressions.or_op import OrOp


class DivOp(BaseBinaryOp):
    op = "div"

    def missing(self):
        return self.lang[
            AndOp(
                [
                    self.default.missing(),
                    OrOp(
                        [self.lhs.missing(), self.rhs.missing(), EqOp([self.rhs, ZERO])]
                    ),
                ]
            )
        ].partial_eval()

    @simplified
    def partial_eval(self):
        default = self.default.partial_eval()
        rhs = self.rhs.partial_eval()
        if rhs is ZERO:
            return default
        lhs = self.lhs.partial_eval()
        if is_literal(lhs) and is_literal(rhs):
            return Literal(builtin_ops[self.op](lhs.value, rhs.value))
        return self.__class__([lhs, rhs], default=default)
