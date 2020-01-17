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

from jx_base.expressions import DivOp as DivOp_
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import Null, wrap
from mo_sql import sql_coalesce, sql_iso


class DivOp(DivOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        lhs = BQLang[self.lhs].to_bq(schema)[0].sql.n
        rhs = BQLang[self.rhs].to_bq(schema)[0].sql.n
        d = BQLang[self.default].to_bq(schema)[0].sql.n

        if lhs and rhs:
            if d == None:
                return wrap(
                    [{"name": ".", "sql": {"n": sql_iso(lhs) + " / " + sql_iso(rhs)}}]
                )
            else:
                return wrap(
                    [
                        {
                            "name": ".",
                            "sql": {
                                "n": sql_coalesce(
                                    [sql_iso(lhs) + " / " + sql_iso(rhs), d]
                                )
                            },
                        }
                    ]
                )
        else:
            return Null
