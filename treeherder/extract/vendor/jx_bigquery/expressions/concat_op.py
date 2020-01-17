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

from jx_base.expressions import ConcatOp as ConcatOp_, TrueOp
from jx_bigquery.expressions._utils import BQLang, check
from jx_bigquery.expressions.length_op import LengthOp
from jx_bigquery.expressions.bql_script import BQLScript
from mo_dots import coalesce
from mo_json import STRING
from mo_sql import (
    SQL,
    SQL_CASE,
    SQL_ELSE,
    SQL_EMPTY_STRING,
    SQL_END,
    SQL_NULL,
    SQL_THEN,
    SQL_WHEN,
    sql_iso,
    sql_list,
    sql_concat_text,
)
from jx_mysql.mysql import quote_value


class ConcatOp(ConcatOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        default = self.default.to_bq(schema)
        if len(self.terms) == 0:
            return default
        default = coalesce(default[0].sql.s, SQL_NULL)
        sep = BQLang[self.separator].to_bq(schema)[0].sql.s

        acc = []
        for t in self.terms:
            t = BQLang[t]
            missing = t.missing().partial_eval()

            term = t.to_bq(schema, not_null=True)[0].sql
            if term.s:
                term_sql = term.s
            elif term.n:
                term_sql = "cast(" + term.n + " as text)"
            else:
                term_sql = (
                    SQL_CASE
                    + SQL_WHEN
                    + term.b
                    + SQL_THEN
                    + quote_value("true")
                    + SQL_ELSE
                    + quote_value("false")
                    + SQL_END
                )

            if isinstance(missing, TrueOp):
                acc.append(SQL_EMPTY_STRING)
            elif missing:
                acc.append(
                    SQL_CASE
                    + SQL_WHEN
                    + sql_iso(missing.to_bq(schema, boolean=True)[0].sql.b)
                    + SQL_THEN
                    + SQL_EMPTY_STRING
                    + SQL_ELSE
                    + sql_iso(sql_concat_text([sep, term_sql]))
                    + SQL_END
                )
            else:
                acc.append(sql_concat_text([sep, term_sql]))

        expr_ = "SUBSTR" + sql_iso(
            sql_list(
                [
                    sql_concat_text(acc),
                    LengthOp(self.separator).to_bq(schema)[0].sql.n + SQL("+1"),
                ]
            )
        )

        return BQLScript(
            expr=expr_,
            data_type=STRING,
            frum=self,
            miss=self.missing(),
            many=False,
            schema=schema,
        )
