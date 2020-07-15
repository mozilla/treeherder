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

from jx_base.expressions import LengthOp as LengthOp_
from jx_base.expressions.literal import is_literal
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import Null, wrap
from mo_future import text
from mo_json import value2json
from jx_bigquery.sql import SQL, sql_iso, ConcatSQL


class LengthOp(LengthOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        term = BQLang[self.term].partial_eval()
        if is_literal(term):
            from jx_bigquery.sql import quote_value

            val = term.value
            if isinstance(val, text):
                sql = quote_value(len(val))
            elif isinstance(val, (float, int)):
                sql = quote_value(len(value2json(val)))
            else:
                return Null
        else:
            value = term.to_bq(schema, not_null=not_null)[0].sql.s
            sql = ConcatSQL(SQL("LENGTH"), sql_iso(value))
        return wrap([{"name": ".", "sql": {"n": sql}}])
