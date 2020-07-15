# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import
from __future__ import division
from __future__ import unicode_literals

from collections import Mapping

import mo_json
from jx_mysql.mysql import int_list_packer, quote_column, quote_value, quote_list, sql_alias, _esfilter2sqlwhere
from mo_collections.matrix import Matrix
from mo_dots import listwrap, unwrap
from mo_dots.lists import FlatList
from mo_future import text, items
from mo_kwargs import override
from mo_logs import Log
from mo_logs.exceptions import suppress_exception
from mo_logs.strings import expand_template
from mo_sql import SQL, SQL_ORDERBY, SQL_LIMIT, sql_list, SQL_WHERE


class MySQL_forBugzilla(object):
    """
    jx to MySQL DATABASE QUERIES

    NEW CODE SHOULD NOT USE THIS: SUBSUMED BY THE REST OF THE LIBRARY
    """

    @override
    def __init__(
        self,
        host,
        port=3306,
        username=None,
        password=None,
        debug=False,
        schema=None,
        preamble=None,
        readonly=False,
        kwargs=None
    ):
        from jx_mysql.mysql import MySQL

        self.settings = kwargs
        self._db = MySQL(kwargs)

    def __data__(self):
        settings = self.settings.copy()
        settings.settings = None
        return unwrap(settings)

    def query(self, query, stacked=False):
        """
        TRANSLATE JSON QUERY EXPRESSION ON SINGLE TABLE TO SQL QUERY
        """
        from jx_base.query import QueryOp

        query = QueryOp.wrap(query)

        sql, post = self._subquery(query, isolate=False, stacked=stacked)
        query.data = post(sql)
        return query.data

    def update(self, query):
        self.db.execute("""
            UPDATE {{table_name}}
            SET {{assignment}}
            {{where}}
        """, {
            "table_name": query["from"],
            "assignment": ",".join(quote_column(k) + "=" + quote_value(v) for k, v in query.set),
            "where": self._where2sql(query.where)
        })

    def _subquery(self, query, isolate=True, stacked=False):
        """
        RETURN (sql, post), WHERE post IS A FUNCTION TO CALL ON ROWS TO GET THE RESULT
        :param query:
        :param isolate:
        :param stacked:
        :return:
        """
        if isinstance(query, text):
            return quote_column(query), None
        if query.name:  # IT WOULD BE SAFER TO WRAP TABLE REFERENCES IN A TYPED OBJECT (Cube, MAYBE?)
            return quote_column(query.name), None

        if query.edges:
            # RETURN A CUBE
            sql, post = self._grouped(query, stacked)
        else:
            select = listwrap(query.select)
            if select[0].aggregate != "none":
                sql, post = self._aggop(query)
            else:
                sql, post = self._setop(query)

        if isolate:
            return "(\n" + sql + "\n) a\n", post
        else:
            return sql, post

    def _grouped(self, query, stacked=False):
        select = listwrap(query.select)

        # RETURN SINGLE OBJECT WITH AGGREGATES
        for s in select:
            if s.aggregate not in aggregates:
                Log.error("Expecting all columns to have an aggregate: {{select}}", select=s)

        selects = FlatList()
        groups = FlatList()
        edges = query.edges
        for e in edges:
            if e.domain.type != "default":
                Log.error("domain of type {{type}} not supported, yet", type=e.domain.type)
            groups.append(e.value)
            selects.append(sql_alias(e.value, quote_column(e.name)))

        for s in select:
            selects.append(sql_alias(aggregates[s.aggregate].replace("{{code}}", s.value), quote_column(s.name)))

        sql = expand_template("""
            SELECT
                {{selects}}
            FROM
                {{table}}
            {{where}}
            GROUP BY
                {{groups}}
        """, {
            "selects": SQL(",\n".join(selects)),
            "groups": SQL(",\n".join(groups)),
            "table": self._subquery(query["from"])[0],
            "where": self._where2sql(query.where)
        })

        def post_stacked(sql):
            # RETURN IN THE USUAL DATABASE RESULT SET FORMAT
            return self.db.query(sql)

        def post(sql):
            # FIND OUT THE default DOMAIN SIZES
            result = self.db.column_query(sql)
            num_edges = len(edges)
            for e, edge in enumerate(edges):
                domain = edge.domain
                if domain.type == "default":
                    domain.type = "set"
                    parts = set(result[e])
                    domain.partitions = [{"index": i, "value": p} for i, p in enumerate(parts)]
                    domain.map = {p: i for i, p in enumerate(parts)}
                else:
                    Log.error("Do not know what to do here, yet")

            # FILL THE DATA CUBE
            maps = [(unwrap(e.domain.map), result[i]) for i, e in enumerate(edges)]
            cubes = FlatList()
            for c, s in enumerate(select):
                data = Matrix(*[len(e.domain.partitions) + (1 if e.allow_nulls else 0) for e in edges])
                for rownum, value in enumerate(result[c + num_edges]):
                    coord = [m[r[rownum]] for m, r in maps]
                    data[coord] = value
                cubes.append(data)

            if isinstance(query.select, list):
                return cubes
            else:
                return cubes[0]

        return sql, post if not stacked else post_stacked

    def _aggop(self, query):
        """
        SINGLE ROW RETURNED WITH AGGREGATES
        """
        if isinstance(query.select, list):
            # RETURN SINGLE OBJECT WITH AGGREGATES
            for s in query.select:
                if s.aggregate not in aggregates:
                    Log.error("Expecting all columns to have an aggregate: {{select}}", select=s)

            selects = FlatList()
            for s in query.select:
                selects.append(sql_alias(aggregates[s.aggregate].replace("{{code}}", s.value),quote_column(s.name)))

            sql = expand_template("""
                SELECT
                    {{selects}}
                FROM
                    {{table}}
                {{where}}
            """, {
                "selects": SQL(",\n".join(selects)),
                "table": self._subquery(query["from"])[0],
                "where": self._where2sql(query.filter)
            })

            return sql, lambda sql: self.db.column(sql)[0]  # RETURNING SINGLE OBJECT WITH AGGREGATE VALUES
        else:
            # RETURN SINGLE VALUE
            s0 = query.select
            if s0.aggregate not in aggregates:
                Log.error("Expecting all columns to have an aggregate: {{select}}", select=s0)

            select = sql_alias(aggregates[s0.aggregate].replace("{{code}}", s0.value) , quote_column(s0.name))

            sql = expand_template("""
                SELECT
                    {{selects}}
                FROM
                    {{table}}
                {{where}}
            """, {
                "selects": SQL(select),
                "table": self._subquery(query["from"])[0],
                "where": self._where2sql(query.where)
            })

            def post(sql):
                result = self.db.column_query(sql)
                return result[0][0]

            return sql, post  # RETURN SINGLE VALUE

    def _setop(self, query):
        """
        NO AGGREGATION, SIMPLE LIST COMPREHENSION
        """
        if isinstance(query.select, list):
            # RETURN BORING RESULT SET
            selects = FlatList()
            for s in listwrap(query.select):
                if isinstance(s.value, Mapping):
                    for k, v in s.value.items:
                        selects.append(sql_alias(v, quote_column(s.name + "." + k)))
                if isinstance(s.value, list):
                    for i, ss in enumerate(s.value):
                        selects.append(sql_alias(s.value, quote_column(s.name + "," + str(i))))
                else:
                    selects.append(sql_alias(s.value, quote_column(s.name)))

            sql = expand_template("""
                SELECT
                    {{selects}}
                FROM
                    {{table}}
                {{where}}
                {{sort}}
                {{limit}}
            """, {
                "selects": SQL(",\n".join(selects)),
                "table": self._subquery(query["from"])[0],
                "where": self._where2sql(query.where),
                "limit": self._limit2sql(query.limit),
                "sort": self._sort2sql(query.sort)
            })

            def post_process(sql):
                result = self.db.query(sql)
                for s in listwrap(query.select):
                    if isinstance(s.value, Mapping):
                        for r in result:
                            r[s.name] = {}
                            for k, v in s.value:
                                r[s.name][k] = r[s.name + "." + k]
                                r[s.name + "." + k] = None

                    if isinstance(s.value, list):
                        # REWRITE AS TUPLE
                        for r in result:
                            r[s.name] = tuple(r[s.name + "," + str(i)] for i, ss in enumerate(s.value))
                            for i, ss in enumerate(s.value):
                                r[s.name + "," + str(i)] = None

                expand_json(result)
                return result

            return sql, post_process  # RETURN BORING RESULT SET
        else:
            # RETURN LIST OF VALUES
            if query.select.value == ".":
                select = "*"
            else:
                name = query.select.name
                select = sql_alias(query.select.value, quote_column(name))

            sql = expand_template("""
                SELECT
                    {{selects}}
                FROM
                    {{table}}
                {{where}}
                {{sort}}
                {{limit}}
            """, {
                "selects": SQL(select),
                "table": self._subquery(query["from"])[0],
                "where": self._where2sql(query.where),
                "limit": self._limit2sql(query.limit),
                "sort": self._sort2sql(query.sort)
            })

            if query.select.value == ".":
                def post(sql):
                    result = self.db.query(sql)
                    expand_json(result)
                    return result

                return sql, post
            else:
                return sql, lambda sql: [r[name] for r in self.db.query(sql)]  # RETURNING LIST OF VALUES

    def _sort2sql(self, sort):
        """
        RETURN ORDER BY CLAUSE
        """
        if not sort:
            return ""
        return SQL_ORDERBY + sql_list([quote_column(o.field) + (" DESC" if o.sort == -1 else "") for o in sort])

    def _limit2sql(self, limit):
        return SQL("" if not limit else SQL_LIMIT + str(limit))

    def _where2sql(self, where):
        if where == None:
            return ""
        return SQL_WHERE + _esfilter2sqlwhere(self.db, where)


def expand_json(rows):
    # CONVERT JSON TO VALUES
    for r in rows:
        for k, json in items(r):
            if isinstance(json, text) and json[0:1] in ("[", "{"):
                with suppress_exception:
                    value = mo_json.json2value(json)
                    r[k] = value


# MAP NAME TO SQL FUNCTION
aggregates = {
    "one": "COUNT({{code}})",
    "sum": "SUM({{code}})",
    "add": "SUM({{code}})",
    "count": "COUNT({{code}})",
    "maximum": "MAX({{code}})",
    "minimum": "MIN({{code}})",
    "max": "MAX({{code}})",
    "min": "MIN({{code}})",
    "mean": "AVG({{code}})",
    "average": "AVG({{code}})",
    "avg": "AVG({{code}})",
    "N": "COUNT({{code}})",
    "X0": "COUNT({{code}})",
    "X1": "SUM({{code}})",
    "X2": "SUM(POWER({{code}}, 2))",
    "std": "STDDEV({{code}})",
    "stddev": "STDDEV({{code}})",
    "var": "POWER(STDDEV({{code}}), 2)",
    "variance": "POWER(STDDEV({{code}}), 2)"
}

from jx_base.container import type2container

type2container["mysql"] = MySQL_forBugzilla
