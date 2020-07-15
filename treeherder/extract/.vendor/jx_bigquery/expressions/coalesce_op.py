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

from jx_base.expressions import CoalesceOp as CoalesceOp_, NULL
from jx_bigquery.expressions._utils import BQLang, check
from jx_bigquery.expressions.and_op import AndOp
from jx_bigquery.expressions.bql_script import BQLScript
from jx_bigquery.expressions.missing_op import MissingOp
from jx_bigquery.sql import sql_call
from mo_json import OBJECT, merge_json_type


class CoalesceOp(CoalesceOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        sql = []
        if not self.terms:
            return NULL.to_bq(schema)
        for term in self.terms:
            sql.append(BQLang[term].to_bq(schema))

        return BQLScript(
            data_type=merge_json_type(*(t.type for t in sql)),
            expr=sql_call("COALESCE", *sql),
            frum=self,
            miss=AndOp([MissingOp(t) for t in self.terms]).partial_eval(),
            many=False,
            schema=schema
        )
