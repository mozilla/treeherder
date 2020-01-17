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

from jx_base.expressions import DateOp as DateOp_
from jx_bigquery.expressions._utils import check
from mo_dots import wrap
from jx_mysql.mysql import quote_value


class DateOp(DateOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        return wrap([{"name": ".", "sql": {"n": quote_value(self.value)}}])
