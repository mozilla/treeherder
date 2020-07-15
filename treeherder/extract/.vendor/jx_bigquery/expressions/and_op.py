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

from jx_base.expressions import AndOp as AndOp_, TRUE, FALSE
from jx_bigquery.expressions._utils import check, BQLScript
from mo_json import BOOLEAN
from jx_bigquery.sql import SQL_AND, JoinSQL


class AndOp(AndOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        if not self.terms:
            return TRUE.to_bq(schema)

        return BQLScript(
            expr=JoinSQL(SQL_AND, [self.lang[t].to_bq(schema)for t in self.terms]),
            data_type=BOOLEAN,
            frum=self,
            miss=FALSE,
            schema=schema,
        )
