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

from jx_base.expressions import Variable as Variable_, FALSE, TRUE
from jx_bigquery.expressions._utils import check
from jx_bigquery.expressions.bql_script import BQLScript
from jx_bigquery.expressions.coalesce_op import CoalesceOp
from jx_bigquery.expressions.missing_op import MissingOp
from jx_bigquery.sql import quote_column, GUID, ApiName, escape_name
from jx_bigquery.typed_encoder import untype_path
from mo_dots import relative_field, split_field
from mo_future import first
from mo_json import STRING, OBJECT
from mo_logs import Log
from jx_bigquery.sql import SQL_NULL


class Variable(Variable_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False, many=True):
        var_name = self.var
        if var_name == GUID:
            return BQLScript(
                data_type=STRING,
                expr=quote_column(escape_name(GUID)),
                frum=self,
                miss=FALSE,
                many=False,
                schema=schema
            )
        cols = schema.leaves(var_name)
        if not cols:
            # DOES NOT EXIST
            return BQLScript(
                data_type=OBJECT,
                expr=SQL_NULL,
                frum=self,
                miss=TRUE,
                many=False,
                schema=schema
            )
        elif len(cols) == 1:
            col = first(cols)
            return BQLScript(
                data_type=col.jx_type,
                expr=quote_column(ApiName(*split_field(col.es_column))),
                frum=self,
                miss=MissingOp(self),
                many=False,
                schema=schema
            )
        else:
            coalesce = []
            for col in cols:
                rel_path = untype_path(relative_field(col.name, var_name))
                if rel_path == '.':
                    coalesce.append(Variable(col.name))
                else:
                    Log.error("structure not supported")
            return CoalesceOp(coalesce).to_bq(schema)
