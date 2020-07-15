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

from jx_base.expressions import BetweenOp as BetweenOp_
from jx_bigquery.expressions._utils import check


class BetweenOp(BetweenOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        return self.partial_eval().to_bq(schema)
