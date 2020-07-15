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

from jx_base.expressions import NotLeftOp as NotLeftOp_
from jx_bigquery.expressions._utils import check
from mo_dots import wrap


class NotLeftOp(NotLeftOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        # test_v = self.value.missing().to_bq(boolean=True)[0].sql.b
        # test_l = self.length.missing().to_bq(boolean=True)[0].sql.b
        v = self.value.to_bq(schema, not_null=True)[0].sql.s
        l = "max(0, " + self.length.to_bq(schema, not_null=True)[0].sql.n + ")"

        expr = "substr(" + v + ", " + l + "+1)"
        return wrap([{"name": ".", "sql": {"s": expr}}])
