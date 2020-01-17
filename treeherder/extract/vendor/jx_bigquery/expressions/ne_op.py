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

from jx_base.expressions import NeOp as NeOp_
from jx_bigquery.expressions._utils import check
from jx_bigquery.expressions.eq_op import EqOp
from jx_bigquery.expressions.not_op import NotOp


class NeOp(NeOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        return (
            NotOp("not", EqOp([self.lhs, self.rhs]).partial_eval())
            .partial_eval()
            .to_bq(schema)
        )
