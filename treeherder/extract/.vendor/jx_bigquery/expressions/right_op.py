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

from jx_base.expressions import RightOp as RightOp_, ZERO, simplified
from jx_bigquery.expressions.basic_substring_op import BasicSubstringOp
from jx_bigquery.expressions.length_op import LengthOp
from jx_bigquery.expressions.max_op import MaxOp
from jx_bigquery.expressions.min_op import MinOp
from jx_bigquery.expressions.sub_op import SubOp


class RightOp(RightOp_):
    @simplified
    def partial_eval(self):
        value = self.value.partial_eval()
        length = self.length.partial_eval()
        max_length = LengthOp(value)

        return BasicSubstringOp(
            [
                value,
                MaxOp([ZERO, MinOp([max_length, SubOp([max_length, length])])]),
                max_length,
            ]
        )
