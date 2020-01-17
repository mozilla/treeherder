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

from jx_bigquery.sql import quote_value

from jx_base.expressions import Literal as Literal_
from jx_bigquery.expressions._utils import check
from mo_dots import wrap
from mo_future import text
from mo_math import is_number


class Literal(Literal_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        value = self.value
        if value == None:
            return wrap([{"name": "."}])
        elif isinstance(value, text):
            return wrap([{"name": ".", "sql": {"s": quote_value(value)}}])
        elif is_number(value):
            return wrap([{"name": ".", "sql": {"n": quote_value(value)}}])
        elif value in [True, False]:
            return wrap([{"name": ".", "sql": {"b": quote_value(value)}}])
        else:
            return wrap([{"name": ".", "sql": {"j": quote_value(self.json)}}])
