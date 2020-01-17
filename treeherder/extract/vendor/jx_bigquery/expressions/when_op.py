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

from jx_base.expressions import WhenOp as WhenOp_
from jx_bigquery.expressions._utils import BQLang, check
from mo_dots import wrap
from mo_sql import SQL_CASE, SQL_ELSE, SQL_END, SQL_NULL, SQL_THEN, SQL_WHEN


class WhenOp(WhenOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False, many=True):
        when = BQLang[self.when].partial_eval().to_bq(schema, boolean=True)[0].sql
        then = BQLang[self.then].partial_eval().to_bq(schema, not_null=not_null)[0].sql
        els_ = BQLang[self.els_].partial_eval().to_bq(schema, not_null=not_null)[0].sql
        output = {}
        for t in "bsn":
            if then[t] == None:
                if els_[t] == None:
                    pass
                elif not_null:
                    output[t] = els_[t]
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
                    if not_null:
                        output[t] = then[t]
                    else:
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
