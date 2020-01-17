# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#

from __future__ import absolute_import, division, unicode_literals

import string
from collections import Mapping

from jx_python import jx
from mo_dots import listwrap, wrap
from mo_files.url import hex2chr
from mo_future import text, first, is_text
from mo_logs import Log
from mo_times import Date, Duration
from mo_sql import (
    SQL,
    SQL_FALSE,
    SQL_NULL,
    SQL_SELECT,
    SQL_TRUE,
    sql_iso,
    sql_list,
    SQL_AND,
    ConcatSQL,
    SQL_EQ,
    SQL_IS_NULL,
    SQL_COMMA,
    JoinSQL,
    SQL_FROM,
    SQL_WHERE,
    SQL_ORDERBY,
    SQL_STAR,
    SQL_LT,
    SQL_AS,
)
from mo_times.dates import parse

TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S.%f"
ALLOWED = string.ascii_letters + string.digits
GUID = "_id"  # user accessible, unique value across many machines
UID = "__id__"  # internal numeric id for single-database use


def quote_column(name):
    if not isinstance(name, ApiName):
        Log.error("expecting ApiName")
    esc_name = SQL(".".join("`" + n + "`" for n in name.values))
    return esc_name


class ApiName(object):
    """
    REPRESENT NAMES FROM/TO THE BIGQUERY API
    All names from the API should be wrapped with this
    All names being sent to API should be of this type (name == text(ApiName(name))
    """

    __slots__ = ["values"]

    def __init__(self, *values):
        """
        :param values:  DOt-delimited API names
        """
        if any(not is_text(n) for n in values):
            Log.error("expecting strings")
        self.values = values

    def __add__(self, other):
        if not isinstance(other, ApiName):
            Log.error("not alloweed")
        return ApiName(*(self.values + other.values))

    def __radd__(self, other):
        Log.error("disabled")

    def __iadd__(self, other):
        Log.error("disabled")

    def __eq__(self, other):
        if other == None:
            return False
        if not isinstance(other, ApiName):
            Log.error("not alloweed")
        return self.values == other.values

    def __str__(self):
        return ".".join(self.values)


def escape_name(name):
    if isinstance(name, ApiName):
        return name

    def quote(c):
        if c == "_":
            return "__"
        if c in ALLOWED:
            return c
        return "_" + hex(ord(c))[2:] + "_"

    esc_name = "".join(map(quote, name))
    return ApiName(esc_name)


def unescape_name(esc_name):
    if not isinstance(esc_name, ApiName):
        Log.error("expecting an api name")
    if len(esc_name.values) > 1:
        Log.error("do not knwo how to handle")
    try:
        parts = text(esc_name).split("_")
        result = parts[:1]
        for i, (p, q) in jx.chunk(parts[1:], 2):
            if len(p) == 0:
                result.append("_")
            else:
                result.append(hex2chr(p))
            result.append(q)
        name = "".join(result)
        return name
    except Exception:
        return esc_name


def sql_alias(value, alias):
    if not isinstance(value, SQL) or not isinstance(alias, ApiName):
        Log.error("Expecting (SQL, ApiName) parameters")
    return ConcatSQL((value, SQL_AS, quote_column(alias)))


def sql_call(func_name, parameters):
    return ConcatSQL((SQL(func_name), sql_iso(JoinSQL(SQL_COMMA, parameters))))


def quote_value(value):
    if isinstance(value, (Mapping, list)):
        return SQL(".")
    elif isinstance(value, Date):
        return quote_value(value.format(TIMESTAMP_FORMAT))
    elif isinstance(value, Duration):
        return SQL(text(value.seconds))
    elif is_text(value):
        return SQL("'" + value.replace("'", "''") + "'")
    elif value == None:
        return SQL_NULL
    elif value is True:
        return SQL_TRUE
    elif value is False:
        return SQL_FALSE
    else:
        return SQL(text(value))


def quote_list(values):
    return sql_iso(sql_list(map(quote_value, values)))


def sql_eq(**item):
    """
    RETURN SQL FOR COMPARING VARIABLES TO VALUES (AND'ED TOGETHER)

    :param item: keyword parameters representing variable and value
    :return: SQL
    """
    return SQL_AND.join(
        [
            ConcatSQL((quote_column(k), SQL_EQ, quote_value(v)))
            if v != None
            else ConcatSQL((quote_column(k), SQL_IS_NULL))
            for k, v in item.items()
        ]
    )


def sql_lt(**item):
    """
    RETURN SQL FOR LESS-THAN (<) COMPARISION BETWEEN VARIABLES TO VALUES

    :param item: keyword parameters representing variable and value
    :return: SQL
    """
    k, v = first(item.items())
    return ConcatSQL((quote_column(k), SQL_LT, quote_value(v)))


def sql_query(command):
    """
    VERY BASIC QUERY EXPRESSION TO SQL
    :param command: jx-expression
    :return: SQL
    """
    command = wrap(command)
    acc = [SQL_SELECT]
    if command.select:
        acc.append(JoinSQL(SQL_COMMA, map(quote_column, listwrap(command.select))))
    else:
        acc.append(SQL_STAR)

    acc.append(SQL_FROM)
    acc.append(quote_column(command["from"]))
    if command.where.eq:
        acc.append(SQL_WHERE)
        acc.append(sql_eq(**command.where.eq))
    if command.orderby:
        acc.append(SQL_ORDERBY)
        acc.append(JoinSQL(SQL_COMMA, map(quote_column, listwrap(command.orderby))))
    return ConcatSQL(acc)
