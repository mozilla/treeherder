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

from jx_base.expressions import RangeOp as RangeOp_
from jx_bigquery.expressions._utils import check
from mo_dots import wrap
from mo_sql import SQL_CASE, SQL_ELSE, SQL_END, SQL_NULL, SQL_THEN, SQL_WHEN


class RangeOp(RangeOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        when = self.when.to_bq(schema, boolean=True)[0].sql
        then = self.then.to_bq(schema, not_null=not_null)[0].sql
        els_ = self.els_.to_bq(schema, not_null=not_null)[0].sql
        output = {}
        for t in "bsn":
            if then[t] == None:
                if els_[t] == None:
                    pass
                else:
                    output[t] = (
                        SQL_CASE
                        + SQL_WHEN
                        + when.b
                        + SQL_THEN
                        + SQL_NULL
                        + SQL_ELSE
                        + els_[t]
                        + SQL_END
                    )
            else:
                if els_[t] == None:
                    output[t] = (
                        SQL_CASE + SQL_WHEN + when.b + SQL_THEN + then[t] + SQL_END
                    )
                else:
                    output[t] = (
                        SQL_CASE
                        + SQL_WHEN
                        + when.b
                        + SQL_THEN
                        + then[t]
                        + SQL_ELSE
                        + els_[t]
                        + SQL_END
                    )
        if not output:
            return wrap([{"name": ".", "sql": {"0": SQL_NULL}}])
        else:
            return wrap([{"name": ".", "sql": output}])
