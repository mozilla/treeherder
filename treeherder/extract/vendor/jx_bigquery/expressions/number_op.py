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

from jx_base.expressions import NumberOp as NumberOp_
from jx_bigquery.expressions import _utils
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import wrap
from mo_sql import sql_coalesce


class NumberOp(NumberOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        value = BQLang[self.term].to_bq(schema, not_null=True)
        acc = []
        for c in value:
            for t, v in c.sql.items():
                if t == "s":
                    acc.append("CAST(" + v + " as FLOAT)")
                else:
                    acc.append(v)

        if not acc:
            return wrap([])
        elif len(acc) == 1:
            return wrap([{"name": ".", "sql": {"n": acc[0]}}])
        else:
            return wrap([{"name": ".", "sql": {"n": sql_coalesce(acc)}}])


_utils.NumberOp = NumberOp