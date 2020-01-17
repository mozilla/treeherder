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

from jx_base.expressions import MaxOp as MaxOp_
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import wrap
from mo_sql import sql_iso, sql_list


class MaxOp(MaxOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        terms = [BQLang[t].partial_eval().to_bq(schema)[0].sql.n for t in self.terms]
        return wrap([{"name": ".", "sql": {"n": "max" + sql_iso((sql_list(terms)))}}])
