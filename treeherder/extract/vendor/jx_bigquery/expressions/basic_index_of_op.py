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

from jx_base.expressions import BasicIndexOfOp as BasicIndexOfOp_
from jx_bigquery.expressions._utils import check
from jx_bigquery.expressions.literal import Literal
from mo_dots import wrap
from mo_sql import SQL_CASE, SQL_ELSE, SQL_END, SQL_THEN, SQL_WHEN, sql_iso


class BasicIndexOfOp(BasicIndexOfOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        value = self.value.to_bq(schema)[0].sql.s
        find = self.find.to_bq(schema)[0].sql.s
        start = self.start

        if isinstance(start, Literal) and start.value == 0:
            return wrap(
                [
                    {
                        "name": ".",
                        "sql": {"n": "INSTR" + sql_iso(value + "," + find) + "-1"},
                    }
                ]
            )
        else:
            start_index = start.to_bq(schema)[0].sql.n
            found = "INSTR(SUBSTR" + sql_iso(value + "," + start_index + "+1)," + find)
            return wrap(
                [
                    {
                        "name": ".",
                        "sql": {
                            "n": (
                                SQL_CASE
                                + SQL_WHEN
                                + found
                                + SQL_THEN
                                + found
                                + "+"
                                + start_index
                                + "-1"
                                + SQL_ELSE
                                + "-1"
                                + SQL_END
                            )
                        },
                    }
                ]
            )
