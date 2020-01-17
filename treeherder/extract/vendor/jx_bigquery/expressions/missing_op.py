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

from jx_base.expressions import MissingOp as MissingOp_
from jx_base.language import is_op
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import wrap
from mo_sql import (
    SQL_AND,
    SQL_EMPTY_STRING,
    SQL_FALSE,
    SQL_IS_NULL,
    SQL_OR,
    SQL_TRUE,
    sql_iso,
)


class MissingOp(MissingOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        value = BQLang[self.expr].partial_eval()
        missing_value = value.missing().partial_eval()

        if not is_op(missing_value, MissingOp):
            return missing_value.to_bq(schema)

        value_sql = value.to_bq(schema)

        if len(value_sql) > 1:
            return wrap([{"name": ".", "sql": {"b": SQL_FALSE}}])

        acc = []
        for c in value_sql:
            for t, v in c.sql.items():
                if t == "b":
                    acc.append(sql_iso(v) + SQL_IS_NULL)
                if t == "s":
                    acc.append(
                        sql_iso(sql_iso(v) + SQL_IS_NULL)
                        + SQL_OR
                        + sql_iso(sql_iso(v) + "=" + SQL_EMPTY_STRING)
                    )
                if t == "n":
                    acc.append(sql_iso(v) + SQL_IS_NULL)

        if not acc:
            return wrap([{"name": ".", "sql": {"b": SQL_TRUE}}])
        else:
            return wrap([{"name": ".", "sql": {"b": SQL_AND.join(acc)}}])
