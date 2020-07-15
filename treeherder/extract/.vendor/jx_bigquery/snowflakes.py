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

from google.cloud.bigquery import SchemaField

import jx_base
from jx_bigquery.partitions import Partition
from jx_bigquery.sql import unescape_name, ApiName, escape_name
from jx_bigquery.typed_encoder import (
    bq_type_to_json_type,
    NESTED_TYPE,
    typed_to_bq_type,
    REPEATED,
    json_type_to_bq_type,
    json_type_to_inserter_type,
)
from jx_python import jx
from mo_dots import join_field, startswith_field, coalesce, Data, wrap, split_field
from mo_future import is_text, first, sort_using_key, text, OrderedDict
from mo_json import NESTED, STRUCT, OBJECT, STRING, NUMBER
from mo_logs import Log, Except
from mo_times.dates import Date

DEBUG = True


class Snowflake(jx_base.Snowflake):
    """
    REPRESENTS A JSON SCHEMA, PLUS SOME ADDITIONAL INFO TO MAP IT TO THE BQ SCHEMA
    THE TWO BIGGEST COMPLICATIONS ARE
    1. A FEW PROPERTIES MUST BE MAPPED TO A TOP-LEVEL, WHICH COMPLICATES ALL THE TRANSLATION LOGIC
    2. THE PARTITION FIELD MUST BE A TIMESTAMP, WHICH IS NOT A JSON TYPE
    """

    def __init__(self, es_index, top_level_fields, partition, schema=None):
        """
        :param es_index:  NAME OF THE INDEX (FOR PROVIDING FULL COLUMN DETAILS)
        :param top_level_fields:  REQUIRED TO MAP INNER PROPERTIES TO THE TOP LEVEL, AS REQUIRED BY BQ FOR PARTITIONS AND CLUSTERING
        :param partition:  THE partition.field MUST BE KNOWN SO IT CAN BE CONVERTED FROM UNIX TIME TO bq TIMESTAMP
        """
        self.schema = schema or {}
        if DEBUG:
            if not is_text(es_index):
                Log.error("expecting string")
            if any(len(split_field(k)) > 1 for k in self.schema.keys()):
                Log.error("expecting schema to be a deep structure")
            if any(len(split_field(k)) > 1 for k in top_level_fields.keys()):
                Log.error("expecting top level fields to be a deep structure")

        self.es_index = es_index
        self._columns = None
        self.top_level_fields = top_level_fields
        self._top_level_fields = None  # dict FROM FULL-API-NAME TO TOP-LEVEL-FIELD NAME
        self._es_type_info = Data()
        if partition.field:
            self._es_type_info[partition.field] = "TIMESTAMP"
        self.partition = partition
        self._partition = None

    @property
    def bq_time_partitioning(self):
        _ = self.columns  # ENSURE self_partition HAS BEEN MADE
        return self._partition.bq_time_partitioning

    @property
    def columns(self):
        if not self._columns:
            now = Date.now()
            columns = []

            def parse_schema(schema, tops, es_type_info, jx_path, nested_path, es_path):
                if is_text(schema):
                    json_type = schema
                    expected_es_type = json_type_to_bq_type[json_type]
                    if es_type_info and es_type_info != expected_es_type:
                        Log.error(
                            "expecting {{path}} to be of type {{expected_type}} not of type {{observed_type}}",
                            path=jx_path,
                            expected_type=expected_es_type,
                            observed_type=es_type_info,
                        )
                    c = jx_base.Column(
                        name=join_field(jx_path),
                        es_column=coalesce(tops, text(es_path)),
                        es_index=self.es_index,
                        es_type=coalesce(es_type_info, expected_es_type),
                        jx_type=json_type,
                        nested_path=nested_path,
                        last_updated=now,
                    )
                    columns.append(c)
                else:
                    c = jx_base.Column(
                        name=join_field(jx_path),
                        es_column=text(es_path),
                        es_index=self.es_index,
                        es_type="RECORD",
                        jx_type=OBJECT,
                        cardinality=1,
                        nested_path=nested_path,
                        last_updated=now,
                    )
                    columns.append(c)
                    count = len(columns)
                    for k, s in schema.items():
                        if k == NESTED_TYPE:
                            c.jx_type = NESTED
                            parse_schema(
                                s,
                                tops if is_text(tops) else tops[k],
                                es_type_info
                                if is_text(es_type_info)
                                else es_type_info[k],
                                jx_path + (k,),
                                (jx_path,) + nested_path,
                                es_path + escape_name(k),
                            )
                        else:
                            parse_schema(
                                s,
                                tops if is_text(tops) else tops[k],
                                es_type_info
                                if is_text(es_type_info)
                                else es_type_info[k],
                                jx_path + (k,),
                                nested_path,
                                es_path + escape_name(k),
                            )
                    if is_text(tops) and len(columns) > count + 1:
                        Log.error(
                            "too many top level fields at {{field}}:",
                            field=join_field(jx_path),
                        )

            parse_schema(
                self.schema,
                self.top_level_fields,
                self._es_type_info,
                (),
                (".",),
                ApiName(),
            )
            self._columns = columns

            self._top_level_fields = OrderedDict()  # FORCE ORDERING
            for path, field in jx.sort(wrap(self.top_level_fields).leaves(), 0):
                leaves = self.leaves(path)
                if not leaves:
                    continue
                if len(leaves) > 1:
                    Log.error(
                        "expecting {{path}} to have just one primitive value", path=path
                    )
                specific_path = first(leaves).name
                self._top_level_fields[
                    ".".join(text(escape_name(step)) for step in split_field(specific_path))
                ] = field
            self._partition = Partition(kwargs=self.partition, flake=self)

        return self._columns

    @classmethod
    def parse(cls, big_query_schema, es_index, top_level_fields, partition):
        """
        PARSE A BIGQUERY SCHEMA
        :param schema:  BQ SCHEMA (WHICH IS A list OF SCHEMA OBJECTS
        :param es_index:  NAME OF THE BQ TABLE
        :param top_level_fields: MAP FROM PROPERTY PATH TO TOP-LEVEL-FIELDNAME
        :param partition: SO WE KNOW WHICH FIELD MUST BE A TIMESTAMP
        :return:
        """

        def parse_schema(big_query_schema, jx_path, nested_path, es_path):
            output = OrderedDict()

            if any(ApiName(e.name) == REPEATED for e in big_query_schema):
                big_query_schema = [
                    e for e in big_query_schema if ApiName(e.name) == REPEATED
                ]

            for e in big_query_schema:
                json_type = bq_type_to_json_type[e.field_type]
                name = unescape_name(ApiName(e.name))
                full_name = jx_path + (name,)
                full_es_path = es_path + (e.name,)

                if e.field_type == "RECORD":
                    if e.mode == "REPEATED":
                        output[name] = parse_schema(
                            e.fields, full_name, (jx_path,) + nested_path, full_es_path
                        )
                    else:
                        output[name] = parse_schema(
                            e.fields, full_name, nested_path, full_es_path
                        )
                else:
                    if e.mode == "REPEATED":
                        output[name] = {NESTED_TYPE: json_type}
                    else:
                        output[name] = json_type
            return output

        output = Snowflake(es_index, Data(), partition)

        # GRAB THE TOP-LEVEL FIELDS
        top_fields = [field for path, field in top_level_fields.leaves()]
        i = 0
        while i < len(big_query_schema) and big_query_schema[i].name in top_fields:
            i = i + 1

        output.top_level_fields = top_level_fields
        output.schema = parse_schema(big_query_schema[i:], (), (".",), ())

        # INSERT TOP-LEVEL FIELDS INTO THE loopkup
        schema = wrap(output.schema)
        for column in big_query_schema[:i]:
            path = first(
                name
                for name, field in top_level_fields.leaves()
                if field == column.name
            )
            json_type = bq_type_to_json_type[column.field_type]
            schema[path] = OrderedDict(
                [(json_type_to_inserter_type[json_type], json_type)]
            )
        return output

    def leaves(self, name):
        return [
            c
            for c in self.columns
            if c.jx_type not in STRUCT and startswith_field(c.name, name)
        ]

    def __eq__(self, other):
        if not isinstance(other, Snowflake):
            return False

        def identical_schema(a, b):
            if is_text(b):
                return a == b
            if len(a.keys()) != len(b.keys()):
                return False
            for (ka, va), (kb, vb) in zip(a.items(), b.items()):
                # WARNING!  ASSUMES dicts ARE OrderedDict
                if ka != kb or not identical_schema(va, vb):
                    return False
            return True

        return identical_schema(self.schema, other.schema)

    def __or__(self, other):
        return merge(self, other)

    def to_bq_schema(self):
        top_fields = []

        def _schema_to_bq_schema(jx_path, es_path, schema):
            output = []
            nt = schema.get(NESTED_TYPE)
            if nt:
                schema = {NESTED_TYPE: nt}
            for t, sub_schema in jx.sort(schema.items(), 0):
                bqt = typed_to_bq_type.get(
                    t, {"field_type": "RECORD", "mode": "NULLABLE"}
                )
                full_name = es_path + escape_name(t)
                top_field = self._top_level_fields.get(text(full_name))
                if is_text(sub_schema):
                    new_field_type = json_type_to_bq_type.get(sub_schema, sub_schema)
                    if new_field_type != bqt["field_type"]:
                        # OVERRIDE TYPE
                        bqt = bqt.copy()
                        bqt["field_type"] = new_field_type
                    fields = ()
                else:
                    fields = _schema_to_bq_schema(jx_path + (t,), full_name, sub_schema)

                if top_field:
                    if fields:
                        Log.error("not expecting a structure")
                    if self._partition.field == top_field:
                        if bqt["field_type"] != "TIMESTAMP":
                            Log.error("Partition field must be of time type")
                    struct = SchemaField(name=top_field, fields=fields, **bqt)
                    top_fields.append(struct)
                elif not fields and bqt["field_type"] == "RECORD":
                    # THIS CAN HAPPEN WHEN WE MOVE A PRIMITIVE FIELD TO top_fields
                    pass
                else:
                    struct = SchemaField(
                        name=text(escape_name(t)), fields=fields, **bqt
                    )
                    output.append(struct)
            return output

        _ = self.columns  # ENSURE schema HAS BEEN PROCESSED
        if not self.schema:
            return []
        main_schema = _schema_to_bq_schema((), ApiName(), self.schema)
        output = sort_using_key(top_fields, key=lambda v: v.name) + main_schema
        return output


def merge(schemas, es_index, top_level_fields, partition):
    def _merge(*schemas):
        if len(schemas) == 1:
            return schemas[0]
        try:
            if any(NESTED_TYPE in s for s in schemas):
                # IF THERE ARE ANY ARRAYS, THEN THE MERGE IS AN ARRAY
                new_schemas = []
                for schema in schemas:
                    if NESTED_TYPE in schema:
                        sub_schema = schema[NESTED_TYPE]
                        residue = {k: v for k, v in schema.items() if k != NESTED_TYPE}
                        new_schemas.append(_merge(sub_schema, residue))
                    else:
                        new_schemas.append(schema)
                return {NESTED_TYPE: _merge(*new_schemas)}
            else:
                return OrderedDict(
                    (k, _merge(*(ss for s in schemas for ss in [s.get(k)] if ss)))
                    for k in jx.sort(set(k for s in schemas for k in s.keys()))
                )
        except Exception as e:
            e = Except.wrap(e)
            if "Expecting types to match" in e:
                raise e
            t = list(set(schemas))
            if len(t) == 1:
                return t[0]
            elif len(t) == 2 and STRING in t and NUMBER in t:
                return STRING
            else:
                Log.error("Expecting types to match {{types|json}}", types=t)

    output = Snowflake(
        es_index=es_index, top_level_fields=top_level_fields, partition=partition
    )
    output.schema = _merge(*(s.schema for s in schemas))
    return output
