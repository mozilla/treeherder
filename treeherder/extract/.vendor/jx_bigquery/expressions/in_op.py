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

from jx_base.expressions import InOp as InOp_, FALSE
from jx_base.language import is_op
from jx_bigquery.expressions._utils import BQLang, check, BQLScript
from jx_bigquery.expressions.literal import Literal
from jx_bigquery.sql import quote_list
from mo_json import BOOLEAN
from mo_logs import Log
from jx_bigquery.sql import SQL_FALSE, ConcatSQL, SQL_IN


class InOp(InOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        if not is_op(self.superset, Literal):
            Log.error("Not supported")
        values = self.superset.value
        if values:
            var = BQLang[self.value].to_bq(schema)
            sql = ConcatSQL(var, SQL_IN, quote_list(values))
        else:
            sql = SQL_FALSE

        return BQLScript(
            expr=sql,
            data_type=BOOLEAN,
            frum=self,
            miss=FALSE,
            schema=schema,
        )