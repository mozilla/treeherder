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

from jx_base.expressions import NotOp as NotOp_
from jx_base.language import is_op
from jx_bigquery.expressions._utils import check
from jx_bigquery.expressions.boolean_op import BooleanOp
from mo_dots import wrap
from mo_sql import sql_iso


class NotOp(NotOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        not_expr = NotOp(BooleanOp(self.term)).partial_eval()
        if is_op(not_expr, NotOp):
            return wrap(
                [
                    {
                        "name": ".",
                        "sql": {
                            "b": "NOT " + sql_iso(not_expr.term.to_bq(schema)[0].sql.b)
                        },
                    }
                ]
            )
        else:
            return not_expr.to_bq(schema)
