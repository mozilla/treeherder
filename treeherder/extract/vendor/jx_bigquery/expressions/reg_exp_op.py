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

from jx_base.expressions import RegExpOp as RegExpOp_
from jx_bigquery.expressions._utils import check
from mo_dots import wrap
from mo_json import json2value


class RegExpOp(RegExpOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        pattern = quote_value(json2value(self.pattern.json))
        value = self.var.to_bq(schema)[0].sql.s
        return wrap([{"name": ".", "sql": {"b": value + " REGEXP " + pattern}}])
