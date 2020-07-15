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

from jx_base.expressions import (
    EqOp as EqOp_,
    FALSE,
    TRUE,
    simplified,
)
from jx_base.expressions._utils import builtin_ops
from jx_bigquery.expressions._utils import BQLang, check
from jx_bigquery.expressions.bql_script import BQLScript
from jx_bigquery.expressions.case_op import CaseOp
from jx_bigquery.expressions.literal import Literal
from jx_bigquery.expressions.sql_eq_op import SqlEqOp
from jx_bigquery.expressions.when_op import WhenOp
from jx_bigquery.sql import sql_iso, SQL_EQ, ConcatSQL
from mo_json import BOOLEAN, STRUCT
from mo_logs import Log


class EqOp(EqOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        lhs = BQLang[self.lhs].to_bq(schema)
        rhs = BQLang[self.rhs].to_bq(schema)

        if lhs.type in STRUCT or rhs.type in STRUCT:
            Log.error("not supported yet")

        return BQLScript(
            data_type=BOOLEAN,
            expr=ConcatSQL(sql_iso(lhs), SQL_EQ, sql_iso(rhs)),
            frum=self,
            miss=FALSE,
            many=False,
            schema=schema
        )


    @simplified
    def partial_eval(self):
        lhs = self.lhs.partial_eval()
        rhs = self.rhs.partial_eval()

        if isinstance(lhs, Literal) and isinstance(rhs, Literal):
            return TRUE if builtin_ops["eq"](lhs.value, rhs.value) else FALSE
        else:
            rhs_missing = rhs.missing().partial_eval()
            output = CaseOp(
                [
                    WhenOp(lhs.missing(), **{"then": rhs_missing}),
                    WhenOp(rhs_missing, **{"then": FALSE}),
                    SqlEqOp([lhs, rhs]),
                ]
            ).partial_eval()
            return output
