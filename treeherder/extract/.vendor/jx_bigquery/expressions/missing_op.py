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

from jx_base.expressions import MissingOp as MissingOp_, FALSE
from jx_base.language import is_op
from jx_bigquery.expressions._utils import BQLang, check, BQLScript
from jx_bigquery.sql import (
    SQL_IS_NULL,
    sql_iso,
    ConcatSQL)
from mo_json import OBJECT, BOOLEAN


class MissingOp(MissingOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        value = BQLang[self.expr].partial_eval()
        missing_value = value.missing().partial_eval()

        if not is_op(missing_value, MissingOp):
            return missing_value.to_bq(schema)

        value_sql = value.to_bq(schema)

        if value_sql.type == OBJECT:
            return FALSE.to_bq(schema)

        return BQLScript(
            data_type=BOOLEAN,
            expr=ConcatSQL(sql_iso(value_sql), SQL_IS_NULL),
            frum=self,
            miss=FALSE,
            many=False,
            schema=schema
        )