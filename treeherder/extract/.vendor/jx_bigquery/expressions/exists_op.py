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

from jx_base.expressions import ExistsOp as ExistsOp_, FALSE
from jx_bigquery.expressions._utils import check, BQLang
from jx_bigquery.expressions.bql_script import BQLScript
from mo_json import BOOLEAN
from jx_bigquery.sql import SQL_IS_NOT_NULL, ConcatSQL


class ExistsOp(ExistsOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        field = BQLang[self.expr].to_bq(schema)

        return BQLScript(
            data_type=BOOLEAN,
            expr=ConcatSQL(field, SQL_IS_NOT_NULL),
            frum=self,
            miss=FALSE,
            many=False,
            schema=schema
        )
