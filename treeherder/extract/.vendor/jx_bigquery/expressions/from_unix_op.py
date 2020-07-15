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

from jx_base.expressions import FromUnixOp as FromUnixOp_
from jx_bigquery.expressions._utils import check
from jx_bigquery.expressions.sql_script import SQLScript
from jx_bigquery.sql import sql_call
from mo_json import TIME


class FromUnixOp(FromUnixOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        v = self.value.to_bq(schema)[0].sql.n

        output = SQLScript(
            data_type=TIME,
            expr=sql_call("FROM_UNIXTIME", v),
            frum=self,
            miss=self.missing(),
            many=False,
            schema=schema,
        )
        return output
