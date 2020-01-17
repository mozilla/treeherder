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

from jx_bigquery.sql import quote_list

from jx_base.expressions import InOp as InOp_
from jx_base.language import is_op
from jx_bigquery.expressions._utils import BQLang, check
from jx_bigquery.expressions.literal import Literal
from mo_dots import wrap
from mo_json import json2value
from mo_logs import Log
from mo_sql import SQL_FALSE, SQL_OR, sql_iso, ConcatSQL, SQL_IN


class InOp(InOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        if not is_op(self.superset, Literal):
            Log.error("Not supported")
        j_value = json2value(self.superset.json)
        if j_value:
            var = BQLang[self.value].to_bq(schema)
            sql = SQL_OR.join(
                sql_iso(ConcatSQL((v, SQL_IN, quote_list(j_value))))
                for t, v in var[0].sql.items()
            )
        else:
            sql = SQL_FALSE
        return wrap([{"name": ".", "sql": {"b": sql}}])
