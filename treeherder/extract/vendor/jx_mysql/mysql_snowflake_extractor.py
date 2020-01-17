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

from copy import deepcopy, copy

from jx_python import jx
from mo_collections import UniqueIndex
from mo_dots import (
    coalesce,
    Data,
    wrap,
    Null,
    FlatList,
    unwrap,
    join_field,
    split_field,
    relative_field,
    concat_field,
    literal_field,
    set_default,
    startswith_field,
    listwrap,
)
from mo_dots.lists import last
from mo_future import text, sort_using_key, first
from mo_kwargs import override
from mo_logs import Log, strings
from mo_logs.exceptions import Explanation
from mo_math.randoms import Random
from mo_times import Timer
from mo_sql import (
    SQL_SELECT,
    sql_list,
    SQL_NULL,
    sql_iso,
    SQL_FROM,
    SQL_INNER_JOIN,
    SQL_LEFT_JOIN,
    SQL_ON,
    SQL_UNION_ALL,
    SQL_ORDERBY,
    SQL_STAR,
    SQL_IS_NOT_NULL,
    SQL,
    SQL_AND,
    SQL_EQ,
    ConcatSQL,
    SQL_LIMIT,
    SQL_ONE,
)
from jx_mysql.mysql import MySQL, quote_column, sql_alias

DEBUG = True


class MySqlSnowflakeExtractor(object):
    @override
    def __init__(self, kwargs=None):
        self.settings = kwargs
        excludes = listwrap(self.settings.exclude)
        self.settings.exclude = set(e for e in excludes if len(split_field(e)) == 1)
        self.settings.exclude_columns = set(
            p for e in excludes for p in [tuple(split_field(e))] if len(p) > 1
        )
        self.settings.exclude_path = list(
            map(split_field, listwrap(self.settings.exclude_path))
        )
        self.settings.show_foreign_keys = coalesce(
            self.settings.show_foreign_keys, True
        )
        self.name_relations = unwrap(coalesce(self.settings.name_relations, {}))

        self.all_nested_paths = None
        self.nested_path_to_join = None
        self.columns = None

        with Explanation("scan database", debug=DEBUG):
            self.db = MySQL(**kwargs.database)
            self.settings.database.schema = self.db.settings.schema
            with self.db:
                with self.db.transaction():
                    self._scan_database()
        if not self.settings.database.schema:
            Log.error("you must provide a `database.schema`")

    def get_sql(self, get_ids):
        sql = self._compose_sql(get_ids)

        # ORDERING
        sort = []
        ordering = []
        for ci, c in enumerate(self.columns):
            if c.sort:
                sort.append(quote_column(c.column_alias) + SQL_IS_NOT_NULL)
                sort.append(quote_column(c.column_alias))
                ordering.append(ci)

        union_all_sql = SQL_UNION_ALL.join(sql)
        union_all_sql = ConcatSQL(
            (
                SQL_SELECT,
                SQL_STAR,
                SQL_FROM,
                sql_alias(sql_iso(union_all_sql), "a"),
                SQL_ORDERBY,
                sql_list(sort),
            )
        )
        return union_all_sql

    def path_not_allowed(self, path):
        return path != "." and any(
            path_in_path(e, p)
            for p in [split_field(path)]
            for e in self.settings.exclude_path
        )

    def _scan_database(self):
        # GET ALL RELATIONS
        raw_relations = self.db.query(
            """
            SELECT
                table_schema,
                table_name,
                referenced_table_schema,
                referenced_table_name,
                referenced_column_name,
                constraint_name,
                column_name,
                ordinal_position
            FROM
                information_schema.key_column_usage
            WHERE
                referenced_column_name IS NOT NULL
            """,
            param=self.settings.database,
        )

        if not raw_relations:
            Log.error("No relations in the database")

        for r in self.settings.add_relations:
            try:
                lhs, rhs = map(strings.trim, r.split("->"))
                lhs = lhs.split(".")
                if len(lhs) == 2:
                    lhs = [self.settings.database.schema] + lhs
                rhs = rhs.split(".")
                if len(rhs) == 2:
                    rhs = [self.settings.database.schema] + rhs
                to_add = Data(
                    ordinal_position=1,  # CAN ONLY HANDLE 1-COLUMN RELATIONS
                    table_schema=lhs[0],
                    table_name=lhs[1],
                    column_name=lhs[2],
                    referenced_table_schema=rhs[0],
                    referenced_table_name=rhs[1],
                    referenced_column_name=rhs[2],
                )

                # CHECK IF EXISTING
                if jx.filter(raw_relations, {"eq": to_add}):
                    Log.note("Relation {{relation}} already exists", relation=r)
                    continue

                to_add.constraint_name = Random.hex(20)
                raw_relations.append(to_add)
            except Exception as e:
                Log.error("Could not parse {{line|quote}}", line=r, cause=e)

        relations = jx.select(
            raw_relations,
            [
                {"name": "constraint.name", "value": "constraint_name"},
                {"name": "table.schema", "value": "table_schema"},
                {"name": "table.name", "value": "table_name"},
                {"name": "column.name", "value": "column_name"},
                {"name": "referenced.table.schema", "value": "referenced_table_schema"},
                {"name": "referenced.table.name", "value": "referenced_table_name"},
                {"name": "referenced.column.name", "value": "referenced_column_name"},
                {"name": "ordinal_position", "value": "ordinal_position"},
            ],
        )

        # GET ALL TABLES
        raw_tables = self.db.query(
            """
            SELECT
                t.table_schema,
                t.table_name,
                c.constraint_name,
                c.constraint_type,
                k.column_name,
                k.ordinal_position
            FROM
                information_schema.tables t
            LEFT JOIN
                information_schema.table_constraints c on c.table_name=t.table_name AND c.table_schema=t.table_schema and (constraint_type='UNIQUE' or constraint_type='PRIMARY KEY')
            LEFT JOIN
                information_schema.key_column_usage k on k.constraint_name=c.constraint_name AND k.table_name=t.table_name and k.table_schema=t.table_schema
            ORDER BY
                t.table_schema,
                t.table_name,
                c.constraint_name,
                k.ordinal_position,
                k.column_name
            """
        )

        # ORGANIZE, AND PICK ONE UNIQUE CONSTRAINT FOR LINKING
        tables = UniqueIndex(keys=["name", "schema"])
        for t, c in jx.groupby(raw_tables, ["table_name", "table_schema"]):
            c = wrap(list(c))
            best_index = Null
            is_referenced = False
            is_primary = False
            for g, w in jx.groupby(c, "constraint_name"):
                if not g.constraint_name:
                    continue
                w = list(w)
                ref = False
                for r in relations:
                    if (
                        r.table.name == t.table_name
                        and r.table.schema == t.table_schema
                        and r.constraint.name == g.constraint_name
                    ):
                        ref = True
                is_prime = w[0].constraint_type == "PRIMARY"

                reasons_this_one_is_better = [
                    best_index == None,  # WE DO NOT HAVE A CANDIDATE YET
                    is_prime and not is_primary,  # PRIMARY KEYS ARE GOOD TO HAVE
                    is_primary == is_prime
                    and ref
                    and not is_referenced,  # REFERENCED UNIQUE TUPLES ARE GOOD TOO
                    is_primary == is_prime
                    and ref == is_referenced
                    and len(w) < len(best_index),  # THE SHORTER THE TUPLE, THE BETTER
                ]
                if any(reasons_this_one_is_better):
                    is_primary = is_prime
                    is_referenced = ref
                    best_index = w

            tables.add(
                {
                    "name": t.table_name,
                    "schema": t.table_schema,
                    "id": [b.column_name for b in best_index],
                }
            )

        fact_table = tables[self.settings.fact_table, self.settings.database.schema]
        ids_table = {
            "alias": "t0",
            "name": "__ids__",
            "schema": fact_table.schema,
            "id": fact_table.id,
        }
        relations.extend(
            wrap(
                {
                    "constraint": {"name": "__link_ids_to_fact_table__"},
                    "table": ids_table,
                    "column": {"name": c},
                    "referenced": {"table": fact_table, "column": {"name": c}},
                    "ordinal_position": i,
                }
            )
            for i, c in enumerate(fact_table.id)
        )
        tables.add(ids_table)

        # GET ALL COLUMNS
        raw_columns = self.db.query(
            """
            SELECT
                column_name,
                table_schema,
                table_name,
                ordinal_position,
                data_type
            FROM
                information_schema.columns
            """
        )

        reference_only_tables = [
            r.split(".")[0]
            for r in self.settings.reference_only
            if len(r.split(".")) == 2
        ]
        reference_all_tables = [
            r.split(".")[0]
            for r in self.settings.reference_only
            if len(r.split(".")) == 1
        ]
        foreign_column_table_schema_triples = {
            (r.column.name, r.table.name, r.table.schema) for r in relations
        }
        referenced_column_table_schema_triples = {
            (
                r.referenced.column.name,
                r.referenced.table.name,
                r.referenced.table.schema,
            )
            for r in relations
        }
        related_column_table_schema_triples = (
            foreign_column_table_schema_triples | referenced_column_table_schema_triples
        )

        columns = UniqueIndex(["column.name", "table.name", "table.schema"])
        for c in raw_columns:
            if c.table_name in reference_only_tables:
                if c.table_name + "." + c.column_name in self.settings.reference_only:
                    include = True
                    reference = True
                    foreign = False
                elif c.column_name in tables[(c.table_name, c.table_schema)].id:
                    include = self.settings.show_foreign_keys
                    reference = False
                    foreign = False
                else:
                    include = False
                    reference = False
                    foreign = False
            elif c.table_name in reference_all_tables:
                # TABLES USED FOR REFERENCE, NO NESTED DOCUMENTS EXPECTED
                if c.column_name in tables[(c.table_name, c.table_schema)].id:
                    include = self.settings.show_foreign_keys
                    reference = True
                    foreign = False
                elif (
                    c.column_name,
                    c.table_name,
                    c.table_schema,
                ) in foreign_column_table_schema_triples:
                    include = False
                    reference = False
                    foreign = True
                else:
                    include = True
                    reference = False
                    foreign = False
            elif c.column_name in tables[(c.table_name, c.table_schema)].id:
                include = self.settings.show_foreign_keys
                reference = False
                foreign = False
            elif (
                c.column_name,
                c.table_name,
                c.table_schema,
            ) in foreign_column_table_schema_triples:
                include = False
                reference = False
                foreign = True
            elif (
                c.column_name,
                c.table_name,
                c.table_schema,
            ) in referenced_column_table_schema_triples:
                include = self.settings.show_foreign_keys
                reference = False
                foreign = False
            else:
                include = True
                reference = False
                foreign = False

            rel = {
                "column": {"name": c.column_name, "type": c.data_type},
                "table": {"name": c.table_name, "schema": c.table_schema},
                "ordinal_position": c.ordinal_position,
                "is_id": c.column_name in tables[(c.table_name, c.table_schema)].id,
                "include": include,  # TRUE IF THIS COLUMN IS OUTPUTTED
                "reference": reference,  # TRUE IF THIS COLUMN REPRESENTS THE ROW
                "foreign": foreign,  # TRUE IF THIS COLUMN POINTS TO ANOTHER ROW
            }
            columns.add(rel)

        # ITERATE OVER ALL PATHS
        todo = FlatList()
        output_columns = FlatList()
        nested_path_to_join = {}
        all_nested_paths = [["."]]

        def follow_paths(position, path, nested_path, done_relations, no_nested_docs):
            if position.name in self.settings.exclude:
                return

            if self.path_not_allowed(path):
                return
            if DEBUG:
                Log.note("Trace {{path}}", path=path)
            if position.name != "__ids__":
                # USED TO CONFIRM WE CAN ACCESS THE TABLE (WILL THROW ERROR WHEN IF IT FAILS)
                self.db.query(
                    ConcatSQL(
                        (
                            SQL_SELECT,
                            SQL_STAR,
                            SQL_FROM,
                            quote_column(position.schema, position.name),
                            SQL_LIMIT,
                            SQL_ONE,
                        )
                    )
                )

            if position.name in reference_all_tables:
                no_nested_docs = True
            if position.name in reference_only_tables:
                return
            curr_join_list = copy(nested_path_to_join[nested_path[0]])

            ###############################################################################
            # INNER OBJECTS
            ###############################################################################
            referenced_tables = list(
                sort_using_key(
                    jx.groupby(
                        jx.filter(
                            relations,
                            {
                                "eq": {
                                    "table.name": position.name,
                                    "table.schema": position.schema,
                                }
                            },
                        ),
                        "constraint.name",
                    ),
                    key=lambda p: first(p[1]).column.name,
                )
            )
            for g, constraint_columns in referenced_tables:
                g = unwrap(g)
                constraint_columns = deepcopy(constraint_columns)
                if g["constraint.name"] in done_relations:
                    continue
                if any(
                    cc
                    for cc in constraint_columns
                    if cc.referenced.table.name in self.settings.exclude
                ):
                    continue

                done_relations.add(g["constraint.name"])

                many_to_one_joins = nested_path_to_join[nested_path[0]]
                index = len(many_to_one_joins)

                alias = "t" + text(index)
                for c in constraint_columns:
                    c.referenced.table.alias = alias
                    c.table = position
                many_to_one_joins.append(
                    {
                        "join_columns": constraint_columns,
                        "path": path,
                        "nested_path": nested_path,
                    }
                )

                # HANDLE THE COMMON *id SUFFIX
                name = []
                for cname, tname in zip(
                    constraint_columns.column.name,
                    constraint_columns.referenced.table.name,
                ):
                    if cname.startswith(tname):
                        name.append(tname)
                    elif cname.endswith("_id"):
                        name.append(cname[:-3])
                    else:
                        name.append(cname)

                relation_string = many_to_one_string(constraint_columns[0])
                step = "/".join(name)
                if len(constraint_columns) == 1:
                    step = self.name_relations.get(relation_string, step)

                referenced_column_path = concat_field(path, step)
                if self.path_not_allowed(referenced_column_path):
                    continue

                if referenced_column_path in reference_only_tables:
                    continue

                col_pointer_name = relative_field(
                    referenced_column_path, nested_path[0]
                )
                for col in columns:
                    if (
                        col.table.name == constraint_columns[0].referenced.table.name
                        and col.table.schema
                        == constraint_columns[0].referenced.table.schema
                    ):
                        col_full_name = concat_field(
                            col_pointer_name, literal_field(col.column.name)
                        )

                        if (
                            col.is_id
                            and col.table.name == fact_table.name
                            and col.table.schema == fact_table.schema
                        ):
                            # ALWAYS SHOW THE ID OF THE FACT
                            c_index = len(output_columns)
                            output_columns.append(
                                {
                                    "table_alias": alias,
                                    "column_alias": "c" + text(c_index),
                                    "column": col,
                                    "sort": True,
                                    "path": referenced_column_path,
                                    "nested_path": nested_path,
                                    "put": col_full_name,
                                }
                            )
                        elif col.column.name == constraint_columns[0].column.name:
                            c_index = len(output_columns)
                            output_columns.append(
                                {
                                    "table_alias": alias,
                                    "column_alias": "c" + text(c_index),
                                    "column": col,
                                    "sort": False,
                                    "path": referenced_column_path,
                                    "nested_path": nested_path,
                                    "put": col_full_name
                                    if self.settings.show_foreign_keys
                                    else None,
                                }
                            )
                        elif col.is_id:
                            c_index = len(output_columns)
                            output_columns.append(
                                {
                                    "table_alias": alias,
                                    "column_alias": "c" + text(c_index),
                                    "column": col,
                                    "sort": False,
                                    "path": referenced_column_path,
                                    "nested_path": nested_path,
                                    "put": col_full_name
                                    if self.settings.show_foreign_keys
                                    else None,
                                }
                            )
                        elif col.reference:
                            c_index = len(output_columns)
                            output_columns.append(
                                {
                                    "table_alias": alias,
                                    "column_alias": "c" + text(c_index),
                                    "column": col,
                                    "sort": False,
                                    "path": referenced_column_path,
                                    "nested_path": nested_path,
                                    "put": col_pointer_name
                                    if not self.settings.show_foreign_keys
                                    else col_full_name,  # REFERENCE FIELDS CAN REPLACE THE WHOLE OBJECT BEING REFERENCED
                                }
                            )
                        elif col.include:
                            c_index = len(output_columns)
                            output_columns.append(
                                {
                                    "table_alias": alias,
                                    "column_alias": "c" + text(c_index),
                                    "column": col,
                                    "sort": False,
                                    "path": referenced_column_path,
                                    "nested_path": nested_path,
                                    "put": col_full_name,
                                }
                            )

                if position.name in reference_only_tables:
                    continue

                todo.append(
                    Data(
                        position=copy(constraint_columns[0].referenced.table),
                        path=referenced_column_path,
                        nested_path=nested_path,
                        done_relations=copy(done_relations),
                        no_nested_docs=no_nested_docs,
                    )
                )
            ###############################################################################
            # NESTED OBJECTS
            ###############################################################################
            if not no_nested_docs:
                nesting_tables = list(
                    sort_using_key(
                        jx.groupby(
                            jx.filter(
                                relations,
                                {
                                    "eq": {
                                        "referenced.table.name": position.name,
                                        "referenced.table.schema": position.schema,
                                    }
                                },
                            ),
                            "constraint.name",
                        ),
                        key=lambda p: [
                            (r.table.name, r.column.name)
                            for r in [first(p[1])]
                        ][0],
                    )
                )

                for g, constraint_columns in nesting_tables:
                    g = unwrap(g)
                    constraint_columns = deepcopy(constraint_columns)
                    if g["constraint.name"] in done_relations:
                        continue
                    done_relations.add(g["constraint.name"])

                    many_table = set(constraint_columns.table.name)
                    if not (many_table - self.settings.exclude):
                        continue

                    relation_string = one_to_many_string(constraint_columns[0])
                    step = "/".join(many_table)
                    if len(constraint_columns) == 1:
                        step = self.name_relations.get(relation_string, step)

                    referenced_column_path = concat_field(path, step)
                    if self.path_not_allowed(referenced_column_path):
                        continue

                    new_nested_path = [referenced_column_path] + nested_path
                    all_nested_paths.append(new_nested_path)

                    if referenced_column_path in nested_path_to_join:
                        Log.error(
                            "{{path}} already exists, try adding entry to name_relations",
                            path=referenced_column_path,
                        )
                    one_to_many_joins = nested_path_to_join[
                        referenced_column_path
                    ] = copy(curr_join_list)
                    index = len(one_to_many_joins)
                    alias = "t" + text(index)
                    for c in constraint_columns:
                        c.table.alias = alias
                        c.referenced.table = position
                    one_to_many_joins.append(
                        set_default(
                            {},
                            g,
                            {
                                "children": True,
                                "join_columns": constraint_columns,
                                "path": path,
                                "nested_path": nested_path,
                            },
                        )
                    )
                    for col in columns:
                        if (
                            col.table.name == constraint_columns[0].table.name
                            and col.table.schema == constraint_columns[0].table.schema
                        ):
                            col_full_name = join_field(
                                split_field(referenced_column_path)[
                                    len(split_field(new_nested_path[0])) :
                                ]
                                + [literal_field(col.column.name)]
                            )

                            if col.column.name == constraint_columns[0].column.name:
                                c_index = len(output_columns)
                                output_columns.append(
                                    {
                                        "table_alias": alias,
                                        "column_alias": "c" + text(c_index),
                                        "column": col,
                                        "sort": col.is_id,
                                        "path": referenced_column_path,
                                        "nested_path": new_nested_path,
                                        "put": col_full_name
                                        if self.settings.show_foreign_keys
                                        else None,
                                    }
                                )
                            elif col.is_id:
                                c_index = len(output_columns)
                                output_columns.append(
                                    {
                                        "table_alias": alias,
                                        "column_alias": "c" + text(c_index),
                                        "column": col,
                                        "sort": col.is_id,
                                        "path": referenced_column_path,
                                        "nested_path": new_nested_path,
                                        "put": col_full_name
                                        if self.settings.show_foreign_keys
                                        else None,
                                    }
                                )
                            else:
                                c_index = len(output_columns)
                                output_columns.append(
                                    {
                                        "table_alias": alias,
                                        "column_alias": "c" + text(c_index),
                                        "column": col,
                                        "sort": col.is_id,
                                        "path": referenced_column_path,
                                        "nested_path": new_nested_path,
                                        "put": col_full_name if col.include else None,
                                    }
                                )

                    todo.append(
                        Data(
                            position=constraint_columns[0].table,
                            path=referenced_column_path,
                            nested_path=new_nested_path,
                            done_relations=copy(done_relations),
                            no_nested_docs=no_nested_docs,
                        )
                    )

        path = "."
        nested_path = [path]
        nested_path_to_join["."] = [
            {
                "path": path,
                "join_columns": [{"referenced": {"table": ids_table}}],
                "nested_path": nested_path,
            }
        ]

        todo.append(
            Data(
                position=ids_table,
                path=path,
                nested_path=nested_path,
                done_relations=set(),
                no_nested_docs=False,
            )
        )

        while todo:
            item = todo.pop(0)
            follow_paths(**item)

        self.all_nested_paths = all_nested_paths
        self.nested_path_to_join = nested_path_to_join
        self.columns = output_columns

    def _compose_sql(self, get_ids):
        """
        :param get_ids: SQL to get the ids, and used to select the documents returned
        :return:
        """
        if not isinstance(get_ids, SQL):
            Log.error("Expecting SQL to get some primary ids")

        sql = []
        for nested_path in self.all_nested_paths:
            # MAKE THE REQUIRED JOINS
            sql_joins = []

            for i, curr_join in enumerate(self.nested_path_to_join[nested_path[0]]):
                curr_join = wrap(curr_join)
                rel = curr_join.join_columns[0]
                if i == 0:
                    sql_joins.append(
                        ConcatSQL(
                            (
                                SQL_FROM,
                                sql_alias(sql_iso(get_ids), rel.referenced.table.alias),
                            )
                        )
                    )
                elif curr_join.children:
                    full_name = quote_column(rel.table.schema, rel.table.name)
                    sql_joins.append(
                        ConcatSQL(
                            (
                                SQL_INNER_JOIN,
                                sql_alias(full_name, rel.table.alias),
                                SQL_ON,
                                SQL_AND.join(
                                    ConcatSQL(
                                        (
                                            quote_column(
                                                rel.table.alias, const_col.column.name
                                            ),
                                            SQL_EQ,
                                            quote_column(
                                                rel.referenced.table.alias,
                                                const_col.referenced.column.name,
                                            ),
                                        )
                                    )
                                    for const_col in curr_join.join_columns
                                ),
                            )
                        )
                    )
                else:
                    full_name = quote_column(
                        rel.referenced.table.schema, rel.referenced.table.name
                    )
                    sql_joins.append(
                        ConcatSQL(
                            (
                                SQL_LEFT_JOIN,
                                sql_alias(full_name, rel.referenced.table.alias),
                                SQL_ON,
                                SQL_AND.join(
                                    ConcatSQL(
                                        (
                                            quote_column(
                                                rel.referenced.table.alias,
                                                const_col.referenced.column.name,
                                            ),
                                            SQL_EQ,
                                            quote_column(
                                                rel.table.alias, const_col.column.name
                                            ),
                                        )
                                    )
                                    for const_col in curr_join.join_columns
                                ),
                            )
                        )
                    )

            # ONLY SELECT WHAT WE NEED, NULL THE REST
            selects = []
            not_null_column_seen = False
            for c in self.columns:
                if (c.column.table.name, c.column.column.name,) in self.settings.exclude_columns:
                    selects.append(sql_alias(SQL_NULL, c.column_alias))
                elif c.nested_path[0] == nested_path[0]:
                    s = sql_alias(
                        quote_column(c.table_alias, c.column.column.name),
                        c.column_alias,
                    )
                    selects.append(s)
                    not_null_column_seen = True
                elif startswith_field(nested_path[0], c.path):
                    # PARENT ID REFERENCES
                    if c.column.is_id:
                        s = sql_alias(
                            quote_column(c.table_alias, c.column.column.name),
                            c.column_alias,
                        )
                        selects.append(s)
                        not_null_column_seen = True
                    else:
                        selects.append(sql_alias(SQL_NULL, c.column_alias))
                else:
                    selects.append(sql_alias(SQL_NULL, c.column_alias))

            if not_null_column_seen:
                sql.append(SQL_SELECT + sql_list(selects) + SQL("").join(sql_joins))
        return sql

    def construct_docs(self, cursor, append, please_stop):
        """
        :param cursor: ITERATOR OF RECORD TUPLES
        :param append: METHOD TO CALL WITH CONSTRUCTED DOCUMENT
        :return: (count, first, next, next_key)
        number of documents added
        the first document in the batch
        the first document of the next batch
        """
        null_values = set(self.settings.null_values) | {None}

        doc_count = 0

        columns = tuple(wrap(c) for c in self.columns)
        with Timer("Downloading from MySQL"):
            curr_doc = Null
            row_count = 0
            for row in cursor:
                row_count += 1
                if please_stop:
                    Log.error("Got `please_stop` signal")

                nested_path = []
                next_object = Data()

                for c, value in zip(columns, row):
                    # columns ARE IN ORDER, FROM FACT ['.'] TO EVER-DEEPER-NESTED
                    if value in null_values:
                        # EVERY COLUMN THAT'S NOT NEEDED IS None
                        continue
                    if len(nested_path) < len(c.nested_path):
                        # EACH COLUMN IS DEEPER THAN THE NEXT
                        # THESE WILL BE THE id COLUMNS, WHICH ARE ALWAYS INCLUDED AND BEFORE ALL OTHER VALUES
                        nested_path = unwrap(c.nested_path)
                        next_object = Data()
                    next_object[c.put] = value

                # OBJECT HAS BEEN CONSTRUCTED, LET'S PLACE IT WHERE IT BELONGS
                if len(nested_path) > 1:
                    children = [curr_doc]
                    steps = list(reversed(nested_path))
                    parent_path = steps[0]
                    for path in steps[1:]:
                        parent = children[-1]
                        relative_path = relative_field(path, parent_path)
                        children = unwrap(parent[relative_path])
                        if not children:
                            children = parent[relative_path] = []
                        parent_path = path

                    children.append(next_object)
                    continue

                # THE TOP-LEVEL next_object HAS BEEN ENCOUNTERED, EMIT THE PREVIOUS, AND COMPLETED curr_doc
                if curr_doc == next_object:
                    Log.error("Expecting records. Did you select the wrong schema, or select records that do not exist?")

                if curr_doc:
                    append(curr_doc["id"])
                    doc_count += 1
                curr_doc = next_object

            # DEAL WITH LAST RECORD
            if curr_doc:
                append(curr_doc["id"])
                doc_count += 1

        Log.note("{{doc_count}} documents ({{row_count}} db records)", doc_count=doc_count, row_count=row_count)


def full_name_string(column):
    return join_field(
        [literal_field(column.table.name), literal_field(column.column.name)]
    )


def one_to_many_string(constraint):
    ref = constraint.referenced

    return full_name_string(ref) + " <- " + full_name_string(constraint)


def many_to_one_string(constraint):
    ref = constraint.referenced

    return full_name_string(constraint) + " -> " + full_name_string(ref)


def path_in_path(sub_path, full_path):
    max_length = len(full_path)
    for i, p in enumerate(full_path):
        for j, pp in enumerate(sub_path):
            ii = i + j
            if ii >= max_length:
                break
            if full_path[i + j] != pp:
                break
        else:
            return True
    return False
