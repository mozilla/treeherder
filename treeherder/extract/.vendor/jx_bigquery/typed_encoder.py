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

import string
from enum import EnumMeta

import mo_math
from jx_bigquery.sql import escape_name, TIMESTAMP_FORMAT, unescape_name, ApiName
from jx_python import jx
from mo_dots import is_many, is_data, split_field, join_field, set_default, to_data
from mo_future import is_text, text
from mo_json import (
    BOOLEAN,
    NUMBER,
    STRING,
    OBJECT,
    NESTED,
    python_type_to_json_type,
    INTEGER,
    INTERVAL,
    TIME,
)
from mo_logs import Log
from mo_times.dates import parse

ALLOWED = string.ascii_letters + string.digits


def typed_encode(value, flake):
    """
    RETURN (typed_value, flake_update, added_nested) TUPLES
    :param value: THE RECORD TO CONVERT TO STRICT TYPED FORM
    :param flake: LOOKUP SCHEMA, WILL BE UPDATED WITH CHANGES
    :return: (record, update, nested) TUPLE
    """
    _ = flake.columns  # ENSURE WE HAVE INTERNAL STRUCTURES FILLED
    output, update, nested = _typed_encode(value, flake.schema)
    if update:
        # REFRESH COLUMNS
        flake._columns = None
        _ = flake.columns

    worker = to_data(output)
    for path, field in flake._top_level_fields.items():
        worker[field] = worker[path]
        worker[path] = None

        # DO NOT LEAVE ANY EMPTY OBJECT RESIDUE
        _path = split_field(path)
        for i, _ in jx.reverse(enumerate(_path)):
            sub_path = join_field(_path[:i])
            v = worker[sub_path]
            if is_data(v) and not worker[sub_path].keys():
                worker[sub_path] = None
            else:
                break

    return output, update, nested


def _typed_encode(value, schema):
    """
    RETURN TRIPLE
    output - THE ENCODED VALUE
    update - THE ADDITIONAL SCHEMA OVER schema PROVIDED
    nested - True IF NESTING IS REQUIRED (CONSIDERED SERIOUS SCHEMA CHANGE)
    """
    if is_many(value):
        if len(value) == 0:
            return None, None, False
        output = []
        update = {}
        nest_added = False
        child_schema = schema.get(NESTED_TYPE)
        if not child_schema:
            nest_added = True
            child_schema = schema[NESTED_TYPE] = {}

        for r in value:
            v, m, n = _typed_encode(r, child_schema)
            output.append(v)
            set_default(update, m)
            nest_added |= n

        if update:
            return {text(REPEATED): output}, {NESTED_TYPE: update}, nest_added
        else:
            return {text(REPEATED): output}, None, nest_added
    elif NESTED_TYPE in schema:
        if not value:
            return {text(REPEATED): []}, None, False
        else:
            return _typed_encode([value], schema)
    elif is_data(value):
        output = {}
        update = {}
        nest_added = False
        for k, v in value.items():
            child_schema = schema.get(k)
            if not child_schema:
                child_schema = schema[k] = {}
            result, more_update, n = _typed_encode(v, child_schema)
            if result != None:
                output[text(escape_name(k))] = result
            set_default(update, {k: more_update})
            nest_added |= n
        return output, update or None, nest_added
    elif is_text(schema):
        v, inserter_type, json_type = schema_type(value)
        if schema != json_type:
            Log.error(
                "Can not convert {{existing_type}} to {{expected_type}}",
                existing_type=json_type,
                expected_type=schema,
            )
        return v, None, False
    elif value == None:
        return {text(escape_name(t)): None for t, child_schema in schema.items()} or None, None, False
    else:
        try:
            v, inserter_type, json_type = schema_type(value)
        except Exception as e:
            # LAST DESPERATE ATTEMPT
            return _typed_encode(value.__data__(), schema)
        child_schema = schema.get(inserter_type)
        update = None
        if not child_schema:
            if schema.get(TIME_TYPE):
                # ATTEMPT TO CONVERT TO TIME, IF EXPECTING TIME
                try:
                    v = parse(v).format(TIMESTAMP_FORMAT)
                    return {text(escape_name(TIME_TYPE)): v}, update, False
                except Exception as e:
                    Log.warning(
                        "Failed attempt to convert {{value}} to TIMESTAMP string",
                        value=v,
                        cause=e,
                    )

            schema[inserter_type] = json_type
            update = {inserter_type: json_type}
        return {text(escape_name(inserter_type)): v}, update, False


def schema_type(value):
    clazz = value.__class__
    if clazz.__class__ == EnumMeta:
        return value.name, json_type_to_inserter_type[STRING], STRING

    jt = python_type_to_json_type[clazz]
    if jt == TIME:
        v = parse(value).format(TIMESTAMP_FORMAT)
    elif jt == NUMBER:
        if mo_math.is_finite(value):
            v = float(value)
        else:
            v = None
    else:
        v = value
    return v, json_type_to_inserter_type[jt], jt


def untype_path(path):
    """
    EXPECTING PYTHON-SIDE PATH (WITHOUT __ ESCAPING)
    """
    return join_field(c for c in split_field(path) if c not in typed_to_bq_type)


def untyped(value):
    """
    REMOVE TYPING AND ESCAPING FROM THE value
    """
    return _untype_value(value)


def _untype_list(value):
    if any(is_data(v) for v in value):
        # MAY BE MORE TYPED OBJECTS IN THIS LIST
        output = [_untype_value(v) for v in value]
    else:
        # LIST OF PRIMITIVE VALUES
        output = value

    if len(output) == 0:
        return None
    elif len(output) == 1:
        return output[0]
    else:
        return output


def _untype_dict(value):
    output = None

    for k, v in value.items():
        k = unescape_name(ApiName(k))
        if k == NESTED_TYPE:
            return _untype_list(v)
        elif k in typed_to_bq_type:
            vv = _untype_value(v)
            if vv is not None:
                # WE ASSUME A PRIMITIVE VALUE, NOT SOME GREATER STRUCTURE
                return vv
        else:
            new_v = _untype_value(v)
            if new_v is not None:
                if output is None:
                    output = {k: new_v}
                else:
                    output[k] = new_v
    return output


_get = object.__getattribute__


def _untype_value(value):
    _type = value.__class__
    if _type is dict:
        return _untype_dict(value)
    elif _type is list:
        return _untype_list(value)
    else:
        return value


json_type_to_bq_type = {
    BOOLEAN: "BOOLEAN",
    NUMBER: "FLOAT64",
    INTEGER: "INT64",
    TIME: "TIMESTAMP",
    INTERVAL: "FLOAT64",
    STRING: "STRING",
    NESTED: "RECORD",
}

bq_type_to_json_type = {
    "INTEGER": INTEGER,
    "INT64": INTEGER,
    "FLOAT64": NUMBER,
    "FLOAT": NUMBER,
    "NUMERIC": NUMBER,
    "BOOL": BOOLEAN,
    "STRING": STRING,
    "BYTES": STRING,
    "DATE": TIME,
    "DATETIME": TIME,
    "TIME": INTERVAL,
    "TIMESTAMP": TIME,
    "RECORD": OBJECT,
}

BOOLEAN_TYPE = "_b_"
INTEGER_TYPE = "_i_"
NUMBER_TYPE = "_n_"
TIME_TYPE = "_t_"
STRING_TYPE = "_s_"
NESTED_TYPE = "_a_"

json_type_to_inserter_type = {
    BOOLEAN: BOOLEAN_TYPE,
    INTEGER: INTEGER_TYPE,
    NUMBER: NUMBER_TYPE,
    TIME: TIME_TYPE,
    INTERVAL: NUMBER_TYPE,
    STRING: STRING_TYPE,
    NESTED: NESTED_TYPE,
}

typed_to_bq_type = {
    BOOLEAN_TYPE: {"field_type": "BOOLEAN", "mode": "NULLABLE"},
    NUMBER_TYPE: {"field_type": "FLOAT64", "mode": "NULLABLE"},
    INTEGER_TYPE: {"field_type": "INT64", "mode": "NULLABLE"},
    TIME_TYPE: {"field_type": "TIMESTAMP", "mode": "NULLABLE"},
    STRING_TYPE: {"field_type": "STRING", "mode": "NULLABLE"},
    NESTED_TYPE: {"field_type": "RECORD", "mode": "REPEATED"},
}

REPEATED = escape_name(NESTED_TYPE)
