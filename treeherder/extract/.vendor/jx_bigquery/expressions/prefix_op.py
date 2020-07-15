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

from jx_base.expressions import PrefixOp as PrefixOp_, FALSE
from jx_bigquery.expressions._utils import check, BQLang
from jx_bigquery.expressions.bql_script import BQLScript
from jx_bigquery.sql import sql_call
from mo_json import BOOLEAN
from jx_bigquery.sql import SQL_TRUE, ConcatSQL, SQL_ONE, SQL_EQ


class PrefixOp(PrefixOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        if not self.expr:
            return BQLScript(
                expr=SQL_TRUE,
                data_type=BOOLEAN,
                frum=self,
                miss=FALSE,
                schema=schema,
            )
        else:
            expr = BQLang[self.expr].to_bq(schema)
            prefix = BQLang[self.prefix].to_bq(schema)
            return BQLScript(
                expr=sql_call("STARTS_WITH", expr, prefix),
                data_type=BOOLEAN,
                frum=self,
                miss=FALSE,
                schema=schema,
            )
