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

from jx_base.expressions import BasicStartsWithOp as BasicStartsWithOp_, ONE
from jx_base.expressions.literal import is_literal
from jx_bigquery.expressions._utils import BQLang, check
from jx_bigquery.expressions.length_op import LengthOp
from jx_bigquery.expressions.sql_eq_op import SqlEqOp
from jx_bigquery.expressions.sql_substr_op import SqlSubstrOp
from jx_bigquery.sql import SQL, ConcatSQL, SQL_LIKE, SQL_ESCAPE
from mo_dots import wrap


class BasicStartsWithOp(BasicStartsWithOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        prefix = BQLang[self.prefix].partial_eval()
        if is_literal(prefix):
            value = BQLang[self.value].partial_eval().to_bq(schema)[0].sql.s
            prefix = prefix.to_bq(schema)[0].sql.s
            if "%" in prefix or "_" in prefix:
                for r in "\\_%":
                    prefix = prefix.replaceAll(r, "\\" + r)
                sql = ConcatSQL(value, SQL_LIKE, prefix, SQL_ESCAPE, SQL("\\"))
            else:
                sql = ConcatSQL(value, SQL_LIKE, prefix)
            return wrap([{"name": ".", "sql": {"b": sql}}])
        else:
            return (
                SqlEqOp([SqlSubstrOp([self.value, ONE, LengthOp(prefix)]), prefix])
                .partial_eval()
                .to_bq()
            )
