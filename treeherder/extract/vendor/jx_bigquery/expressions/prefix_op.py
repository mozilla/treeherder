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

from jx_base.expressions import PrefixOp as PrefixOp_
from jx_bigquery.expressions._utils import check
from mo_dots import wrap
from mo_sql import SQL_TRUE, sql_iso


class PrefixOp(PrefixOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        if not self.expr:
            return wrap([{"name": ".", "sql": {"b": SQL_TRUE}}])
        else:
            return wrap(
                [
                    {
                        "name": ".",
                        "sql": {
                            "b": "INSTR"
                            + sql_iso(
                                self.expr.to_bq(schema)[0].sql.s
                                + ", "
                                + self.prefix.to_bq(schema)[0].sql.s
                            )
                            + "==1"
                        },
                    }
                ]
            )
