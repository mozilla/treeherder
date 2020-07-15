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

from jx_base.expressions import CountOp as CountOp_
from jx_bigquery.expressions._utils import BQLang, check
from jx_bigquery.sql import (
    SQL,
    SQL_CASE,
    SQL_ELSE,
    SQL_END,
    SQL_IS_NULL,
    SQL_THEN,
    SQL_TRUE,
    SQL_WHEN,
    sql_iso,
    SQL_ZERO,
    SQL_ONE,
    ConcatSQL,
)
from mo_dots import wrap


class CountOp(CountOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        acc = []
        for term in self.terms:
            sqls = BQLang[term].to_bq(schema)
            if len(sqls) > 1:
                acc.append(SQL_TRUE)
            else:
                for t, v in sqls[0].sql.items():
                    if t in ["b", "s", "n"]:
                        acc.append(
                            ConcatSQL(
                                SQL_CASE,
                                SQL_WHEN,
                                sql_iso(v),
                                SQL_IS_NULL,
                                SQL_THEN,
                                SQL_ZERO,
                                SQL_ELSE,
                                SQL_ONE,
                                SQL_END,
                            )
                        )
                    else:
                        acc.append(SQL_TRUE)

        if not acc:
            return wrap([{}])
        else:
            return wrap([{"nanme": ".", "sql": {"n": SQL("+").join(acc)}}])
