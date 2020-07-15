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

from jx_base.expressions import Literal as Literal_
from jx_bigquery.expressions._utils import check
from jx_bigquery.expressions.bql_script import BQLScript
from mo_json import python_type_to_json_type


class Literal(Literal_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        from jx_bigquery.sql import quote_value
        value = self.value
        return BQLScript(
            data_type=python_type_to_json_type[value.__class__],
            expr=quote_value(value),
            frum=self,
            miss=self.missing(),
            many=False,
            schema=schema
        )
