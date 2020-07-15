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

from jx_base.expressions import NotOp as NotOp_, FALSE
from jx_bigquery.expressions._utils import check, BQLScript
from mo_json import BOOLEAN
from jx_bigquery.sql import sql_iso, SQL_NOT, ConcatSQL


class NotOp(NotOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        not_expr = self.lang[self.term].to_bq(schema)
        return BQLScript(
            expr=ConcatSQL(SQL_NOT, sql_iso(not_expr)),
            data_type=BOOLEAN,
            frum=self,
            miss=FALSE,
            schema=schema,
        )
