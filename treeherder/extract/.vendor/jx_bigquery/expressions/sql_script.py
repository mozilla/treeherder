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

from jx_base.expressions import FALSE, NULL, ONE, SQLScript as SQLScript_, TRUE, ZERO
from jx_bigquery.expressions._utils import json_type_to_sql_type, SQLang, check
from jx_bigquery.sql import (
    SQL,
    SQL_CASE,
    SQL_END,
    SQL_NULL,
    SQL_THEN,
    SQL_WHEN,
    sql_iso,
    ConcatSQL,
    SQL_NOT,
)
from mo_dots import coalesce, wrap
from mo_future import PY2, text
from mo_logs import Log


class SQLScript(SQLScript_, SQL):
    __slots__ = ("miss", "data_type", "expr", "frum", "many", "schema")

    def __init__(self, data_type, expr, frum, miss=None, many=False, schema=None):
        object.__init__(self)
        if miss not in [None, NULL, FALSE, TRUE, ONE, ZERO]:
            if frum.lang != miss.lang:
                Log.error("logic error")

        self.miss = coalesce(
            miss, FALSE
        )  # Expression that will return true/false to indicate missing result
        self.data_type = data_type  # JSON DATA TYPE
        self.expr = expr
        self.many = many  # True if script returns multi-value
        self.frum = frum  # THE ORIGINAL EXPRESSION THAT MADE expr
        self.schema = schema

    @property
    def type(self):
        return self.data_type

    @property
    def name(self):
        return "."

    def __getitem__(self, item):
        if not self.many:
            if item == 0:
                return self
            else:
                Log.error("this is a primitive value")
        else:
            Log.error("do not know how to handle")

    def __iter__(self):
        """
        ASSUMED PART OF class SQL, RETURN SQL
        """
        for e in self.expr:
            yield e

    @property
    def sql(self):
        self.miss = self.miss.partial_eval()
        if self.miss is TRUE:
            return wrap({json_type_to_sql_type[self.data_type]: SQL_NULL})
        elif self.miss is FALSE:
            return wrap({json_type_to_sql_type[self.data_type]: self.expr})
        else:
            return wrap(
                {
                    json_type_to_sql_type[self.data_type]: ConcatSQL(
                        SQL_CASE,
                        SQL_WHEN,
                        SQL_NOT,
                        sql_iso(SQLang[self.miss].to_sql(self.schema)[0].sql.b),
                        SQL_THEN,
                        self.expr,
                        SQL_END,
                    )
                }
            )

    def __str__(self):
        return str(self.sql)

    def __unicode__(self):
        return text(self.sql)

    def __add__(self, other):
        return text(self) + text(other)

    def __radd__(self, other):
        return text(other) + text(self)

    if PY2:
        __unicode__ = __str__

    @check
    def to_sql(self, schema, not_null=False, boolean=False, many=True):
        return self

    def missing(self):
        return self.miss

    def __data__(self):
        return {"script": self.script}

    def __eq__(self, other):
        if not isinstance(other, SQLScript_):
            return False
        elif self.expr == other.expr:
            return True
        else:
            return False
