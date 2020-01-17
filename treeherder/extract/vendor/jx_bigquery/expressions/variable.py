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

from jx_bigquery.sql import quote_column, GUID, ApiName

from jx_base.expressions import Variable as Variable_
from jx_base.queries import get_property_name
from jx_bigquery.expressions._utils import json_type_to_bq_type, check
from mo_dots import ROOT_PATH, relative_field, wrap
from mo_json import BOOLEAN, OBJECT
from mo_sql import SQL_IS_NOT_NULL, SQL_NULL, SQL_TRUE


class Variable(Variable_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False, many=True):
        var_name = self.var
        if var_name == GUID:
            return wrap(
                [{"name": ".", "sql": {"s": quote_column(ApiName(GUID))}, "nested_path": ROOT_PATH}]
            )
        cols = schema.leaves(var_name)
        if not cols:
            # DOES NOT EXIST
            return wrap(
                [{"name": ".", "sql": {"0": SQL_NULL}, "nested_path": ROOT_PATH}]
            )
        acc = {}
        if boolean:
            for col in cols:
                cname = relative_field(col.name, var_name)
                nested_path = col.nested_path[0]
                if col.type == OBJECT:
                    value = SQL_TRUE
                elif col.type == BOOLEAN:
                    value = quote_column(col.es_column)
                else:
                    value = quote_column(col.es_column) + SQL_IS_NOT_NULL
                tempa = acc.setdefault(nested_path, {})
                tempb = tempa.setdefault(get_property_name(cname), {})
                tempb["b"] = value
        else:
            for col in cols:
                cname = relative_field(col.name, var_name)
                if col.jx_type == OBJECT:
                    prefix = self.var + "."
                    for cn, cs in schema.items():
                        if cn.startswith(prefix):
                            for child_col in cs:
                                tempa = acc.setdefault(child_col.nested_path[0], {})
                                tempb = tempa.setdefault(get_property_name(cname), {})
                                tempb[json_type_to_bq_type[col.type]] = quote_column(
                                    child_col.es_column
                                )
                else:
                    nested_path = col.nested_path[0]
                    tempa = acc.setdefault(nested_path, {})
                    tempb = tempa.setdefault(get_property_name(cname), {})
                    tempb[json_type_to_bq_type[col.jx_type]] = quote_column(
                        col.es_column
                    )

        return wrap(
            [
                {"name": cname, "sql": types, "nested_path": nested_path}
                for nested_path, pairs in acc.items()
                for cname, types in pairs.items()
            ]
        )
