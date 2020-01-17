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

from jx_base.expressions import OrOp as OrOp_
from jx_bigquery.expressions import _utils
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import wrap
from mo_sql import SQL_OR, sql_iso, JoinSQL


class OrOp(OrOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        return wrap(
            [
                {
                    "name": ".",
                    "sql": {
                        "b": JoinSQL(
                            SQL_OR,
                            [
                                sql_iso(BQLang[t].to_bq(schema, boolean=True)[0].sql.b)
                                for t in self.terms
                            ],
                        )
                    },
                }
            ]
        )


_utils.OrOp = OrOp