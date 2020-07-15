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

from jx_base.expressions import CaseOp as CaseOp_
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import coalesce, wrap
from jx_bigquery.sql import (
    SQL_CASE,
    SQL_ELSE,
    SQL_END,
    SQL_NULL,
    SQL_THEN,
    SQL_WHEN,
    ConcatSQL,
)


class CaseOp(CaseOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        if len(self.whens) == 1:
            return BQLang[self.whens[-1]].to_bq(schema)

        output = {}
        for t in "bsn":  # EXPENSIVE LOOP to_bq() RUN 3 TIMES
            els_ = coalesce(BQLang[self.whens[-1]].to_bq(schema)[0].sql[t], SQL_NULL)
            acc = SQL_ELSE + els_ + SQL_END
            for w in reversed(self.whens[0:-1]):
                acc = ConcatSQL(
                    SQL_WHEN,
                    BQLang[w.when].to_bq(schema, boolean=True)[0].sql.b,
                    SQL_THEN,
                    coalesce(BQLang[w.then].to_bq(schema)[0].sql[t], SQL_NULL),
                    acc,
                )
            output[t] = SQL_CASE + acc
        return wrap([{"name": ".", "sql": output}])
