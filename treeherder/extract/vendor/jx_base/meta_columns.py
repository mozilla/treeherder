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

from collections import Mapping

from jx_base import Column, TableDesc
from jx_base.schema import Schema
from mo_collections import UniqueIndex
from mo_dots import (
    Data,
    FlatList,
    NullType,
    ROOT_PATH,
    concat_field,
    is_container,
    join_field,
    listwrap,
    split_field,
    unwraplist,
    wrap)
from mo_future import binary_type, items, long, none_type, reduce, text
from mo_json import INTEGER, NUMBER, STRING, python_type_to_json_type
from mo_times.dates import Date

DEBUG = False
META_TABLES_NAME = "meta.tables"
META_COLUMNS_NAME = "meta.columns"
META_COLUMNS_TYPE_NAME = "column"
singlton = None


def get_schema_from_list(table_name, frum, native_type_to_json_type=python_type_to_json_type):
    """
    SCAN THE LIST FOR COLUMN TYPES
    """
    columns = UniqueIndex(keys=("name",))
    _get_schema_from_list(
        frum,
        ".",
        parent=".",
        nested_path=ROOT_PATH,
        columns=columns,
        native_type_to_json_type=native_type_to_json_type,
    )
    return Schema(table_name=table_name, columns=list(columns))


def _get_schema_from_list(
    frum, # The list
    table_name, # Name of the table this list holds records for
    parent, # parent path
    nested_path, # each nested array, in reverse order
    columns, # map from full name to column definition
    native_type_to_json_type # dict from storage type name to json type name
):
    for d in frum:
        row_type = python_type_to_json_type[d.__class__]

        if row_type != "object":
            # EXPECTING PRIMITIVE VALUE
            full_name = parent
            column = columns[full_name]
            if not column:
                column = Column(
                    name=concat_field(table_name, full_name),
                    es_column=full_name,
                    es_index=".",
                    es_type=d.__class__.__name__,
                    jx_type=None,  # WILL BE SET BELOW
                    last_updated=Date.now(),
                    nested_path=nested_path,
                )
                columns.add(column)
            column.es_type = _merge_python_type(column.es_type, d.__class__)
            column.jx_type = native_type_to_json_type[column.es_type]
        else:
            for name, value in d.items():
                full_name = concat_field(parent, name)
                column = columns[full_name]
                if not column:
                    column = Column(
                        name=concat_field(table_name, full_name),
                        es_column=full_name,
                        es_index=".",
                        es_type=value.__class__.__name__,
                        jx_type=None,  # WILL BE SET BELOW
                        last_updated=Date.now(),
                        nested_path=nested_path,
                    )
                    columns.add(column)
                if is_container(value):  # GET TYPE OF MULTIVALUE
                    v = list(value)
                    if len(v) == 0:
                        this_type = none_type.__name__
                    elif len(v) == 1:
                        this_type = v[0].__class__.__name__
                    else:
                        this_type = reduce(
                            _merge_python_type, (vi.__class__.__name__ for vi in value)
                        )
                else:
                    this_type = value.__class__.__name__
                column.es_type = _merge_python_type(column.es_type, this_type)
                try:
                    column.jx_type = native_type_to_json_type[column.es_type]
                except Exception as e:
                    raise e

                if this_type in {"object", "dict", "Mapping", "Data"}:
                    _get_schema_from_list(
                        [value], table_name, full_name, nested_path, columns, native_type_to_json_type
                    )
                elif this_type in {"list", "FlatList"}:
                    np = listwrap(nested_path)
                    newpath = unwraplist([join_field(split_field(np[0]) + [name])] + np)
                    _get_schema_from_list(
                        value, table_name, full_name, newpath, columns
                    )


def get_id(column):
    """
    :param column:
    :return: Elasticsearch id for column
    """
    return column.es_index + "|" + column.es_column


META_COLUMNS_DESC = TableDesc(
    name=META_COLUMNS_NAME,
    url=None,
    query_path=ROOT_PATH,
    last_updated=Date.now(),
    columns=wrap(
        [
            Column(
                name=c,
                es_index=META_COLUMNS_NAME,
                es_column=c,
                es_type="keyword",
                jx_type=STRING,
                last_updated=Date.now(),
                nested_path=ROOT_PATH,
            )
            for c in [
                "name",
                "es_type",
                "jx_type",
                "nested_path",
                "es_column",
                "es_index",
                "partitions",
            ]
        ]
        + [
            Column(
                name=c,
                es_index=META_COLUMNS_NAME,
                es_column=c,
                es_type="integer",
                jx_type=INTEGER,
                last_updated=Date.now(),
                nested_path=ROOT_PATH,
            )
            for c in ["count", "cardinality", "multi"]
        ]
        + [
            Column(
                name="last_updated",
                es_index=META_COLUMNS_NAME,
                es_column="last_updated",
                es_type="double",
                jx_type=NUMBER,
                last_updated=Date.now(),
                nested_path=ROOT_PATH
            )
        ]
    )

)

META_TABLES_DESC = TableDesc(
    name=META_TABLES_NAME,
    url=None,
    query_path=ROOT_PATH,
    last_updated=Date.now(),
    columns=wrap(
        [
            Column(
                name=c,
                es_index=META_TABLES_NAME,
                es_column=c,
                es_type="string",
                jx_type=STRING,
                last_updated=Date.now(),
                nested_path=ROOT_PATH
            )
            for c in [
                "name",
                "url",
                "query_path"
            ]
        ] + [
            Column(
                name=c,
                es_index=META_TABLES_NAME,
                es_column=c,
                es_type="integer",
                jx_type=INTEGER,
                last_updated=Date.now(),
                nested_path=ROOT_PATH
            )
            for c in [
                "timestamp"
            ]
        ]
    )
)



SIMPLE_METADATA_COLUMNS = (  # FOR PURELY INTERNAL PYTHON LISTS, NOT MAPPING TO ANOTHER DATASTORE
    [
        Column(
            name=c,
            es_index=META_COLUMNS_NAME,
            es_column=c,
            es_type="string",
            jx_type=STRING,
            last_updated=Date.now(),
            nested_path=ROOT_PATH,
        )
        for c in ["table", "name", "type", "nested_path"]
    ]
    + [
        Column(
            name=c,
            es_index=META_COLUMNS_NAME,
            es_column=c,
            es_type="long",
            jx_type=INTEGER,
            last_updated=Date.now(),
            nested_path=ROOT_PATH,
        )
        for c in ["count", "cardinality", "multi"]
    ]
    + [
        Column(
            name="last_updated",
            es_index=META_COLUMNS_NAME,
            es_column="last_updated",
            es_type="time",
            jx_type=NUMBER,
            last_updated=Date.now(),
            nested_path=ROOT_PATH,
        )
    ]
)

_merge_order = {
    none_type: 0,
    NullType: 1,
    bool: 2,
    int: 3,
    long: 3,
    Date: 4,
    float: 5,
    text: 6,
    binary_type: 6,
    object: 7,
    dict: 8,
    Mapping: 9,
    Data: 10,
    list: 11,
    FlatList: 12,
}

for k, v in items(_merge_order):
    _merge_order[k.__name__] = v


def _merge_python_type(A, B):
    a = _merge_order[A]
    b = _merge_order[B]

    if a >= b:
        output = A
    else:
        output = B

    if isinstance(output, str):
        return output
    else:
        return output.__name__
