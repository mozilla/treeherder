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

from jx_base.expressions import ExistsOp as ExistsOp_
from jx_bigquery.expressions._utils import check
from mo_dots import wrap
from mo_sql import SQL_FALSE, SQL_IS_NOT_NULL, SQL_OR, sql_iso


class ExistsOp(ExistsOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        field = self.field.to_bq(schema)[0].sql
        acc = []
        for t, v in field.items():
            if t in "bns":
                acc.append(sql_iso(v + SQL_IS_NOT_NULL))

        if not acc:
            return wrap([{"name": ".", "sql": {"b": SQL_FALSE}}])
        else:
            return wrap([{"name": ".", "sql": {"b": SQL_OR.join(acc)}}])
