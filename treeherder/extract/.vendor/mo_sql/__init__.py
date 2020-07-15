# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#

from __future__ import absolute_import, division, unicode_literals

from mo_future import is_text, PY2
from mo_logs import Log

ENABLE_TYPE_CHECKING = True


class SQL(object):
    """
    THIS CLASS USES THE TYPE SYSTEM TO PREVENT SQL INJECTION ATTACKS
    ENSURES ONLY SQL OBJECTS ARE CONCATENATED TO MAKE MORE SQL OBJECTS
    """

    __slots__ = []

    def __new__(cls, value=None, *args, **kwargs):
        if not args and is_text(value):
            return object.__new__(TextSQL)
        else:
            return object.__new__(cls)

    @property
    def sql(self):
        return "".join(self)

    def __iter__(self):
        raise Log.error("not implemented")

    def __len__(self):
        return len(self.sql)

    def __add__(self, other):
        if not isinstance(other, SQL):
            if (
                is_text(other)
                and ENABLE_TYPE_CHECKING
                and all(c not in other for c in ('"', "'", "`", "\\"))
            ):
                return ConcatSQL(self, SQL(other))
            Log.error("Can only concat other SQL")
        else:
            return ConcatSQL(self, other)

    def __radd__(self, other):
        if not isinstance(other, SQL):
            if (
                    is_text(other)
                    and ENABLE_TYPE_CHECKING
                    and all(c not in other for c in ('"', "'", "`", "\\"))
            ):
                return ConcatSQL(SQL(other), self)
            Log.error("Can only concat other SQL")
        else:
            return ConcatSQL(other, self)

    def join(self, list_):
        return JoinSQL(self, list_)

    def __data__(self):
        return self.sql

    if PY2:

        def __unicode__(self):
            return "".join(self)

    else:

        def __str__(self):
            return "".join(self)


class TextSQL(SQL):
    __slots__ = ["value"]

    def __init__(self, value):
        """
        ACTUAL SQL, DO NOT QUOTE value
        """
        SQL.__init__(self)
        if ENABLE_TYPE_CHECKING and isinstance(value, SQL):
            Log.error("Expecting text, not SQL")
        self.value = value

    def __iter__(self):
        yield self.value


class JoinSQL(SQL):
    __slots__ = ["sep", "concat"]

    def __init__(self, sep, concat):
        """
        CONVIENENCE METHOD TO str.join() SOME SQL
        :param sep: THE SEPARATOR
        :param concat:  A LIST/TUPLE/ITERABLE OF SQL
        """
        SQL.__init__(self)
        if ENABLE_TYPE_CHECKING:
            if not isinstance(concat, (tuple, list)):
                concat = tuple(concat)
            if not isinstance(sep, SQL):
                Log.error("Expecting SQL, not text")
            if any(not isinstance(s, SQL) for s in concat):
                Log.error("Can only join other SQL")
        self.sep = sep
        self.concat = concat

    def __iter__(self):
        sep = NO_SQL
        for v in self.concat:
            for s in sep:
                yield s
            sep = self.sep
            for vv in v:
                yield vv


class ConcatSQL(SQL):
    __slots__ = ["concat"]

    def __init__(self, *concat):
        """
        A SEQUENCE OF SQL FOR EVENTUAL CONCATENATION
        """
        if ENABLE_TYPE_CHECKING:
            if len(concat) == 1:
                Log.error("Expecting at least 2 parameters")
            if any(not isinstance(s, SQL) for s in concat):
                Log.error("Can only join other SQL")
        self.concat = concat

    def __iter__(self):
        for c in self.concat:
            for cc in c:
                yield cc


NO_SQL = tuple()
SQL_STAR = SQL(" * ")
SQL_PLUS = SQL(" + ")

SQL_AND = SQL(" AND ")
SQL_OR = SQL(" OR ")
SQL_NOT = SQL(" NOT ")
SQL_ON = SQL(" ON ")

SQL_CASE = SQL(" CASE ")
SQL_WHEN = SQL(" WHEN ")
SQL_THEN = SQL(" THEN ")
SQL_ELSE = SQL(" ELSE ")
SQL_END = SQL(" END ")

SQL_SPACE = SQL(" ")
SQL_COMMA = SQL(", ")
SQL_UNION_ALL = SQL("\nUNION ALL\n")
SQL_UNION = SQL("\nUNION\n")
SQL_LEFT_JOIN = SQL("\nLEFT JOIN\n")
SQL_INNER_JOIN = SQL("\nJOIN\n")
SQL_EMPTY_STRING = SQL("''")
SQL_ZERO = SQL(" 0 ")
SQL_ONE = SQL(" 1 ")
SQL_TRUE = SQL_ONE
SQL_FALSE = SQL_ZERO
SQL_NEG_ONE = SQL(" -1 ")
SQL_NULL = SQL(" NULL ")
SQL_IS_NULL = SQL(" IS NULL ")
SQL_IS_NOT_NULL = SQL(" IS NOT NULL ")
SQL_SELECT = SQL("\nSELECT\n")
SQL_SELECT_AS_STRUCT = SQL("\nSELECT AS STRUCT\n")
SQL_DELETE = SQL("\nDELETE\n")
SQL_CREATE = SQL("\nCREATE TABLE\n")
SQL_INSERT = SQL("\nINSERT INTO\n")
SQL_FROM = SQL("\nFROM\n")
SQL_WHERE = SQL("\nWHERE\n")
SQL_GROUPBY = SQL("\nGROUP BY\n")
SQL_ORDERBY = SQL("\nORDER BY\n")
SQL_VALUES = SQL("\nVALUES\n")
SQL_DESC = SQL(" DESC ")
SQL_ASC = SQL(" ASC ")
SQL_LIMIT = SQL("\nLIMIT\n")
SQL_UPDATE = SQL("\nUPDATE\n")
SQL_SET = SQL("\nSET\n")

SQL_CONCAT = SQL(" || ")
SQL_AS = SQL(" AS ")
SQL_LIKE = SQL(" LIKE ")
SQL_ESCAPE = SQL(" ESCAPE ")
SQL_OP = SQL("(")
SQL_CP = SQL(")")
SQL_IN = SQL(" IN ")
SQL_GT = SQL(" > ")
SQL_GE = SQL(" >= ")
SQL_EQ = SQL(" = ")
SQL_LT = SQL(" < ")
SQL_LE = SQL(" <= ")
SQL_DOT = SQL(".")
SQL_CR = SQL("\n")


class DB(object):
    def quote_column(self, *path):
        raise NotImplementedError()

    def db_type_to_json_type(self, type):
        raise NotImplementedError()


def sql_list(list_):
    return ConcatSQL(SQL_SPACE, JoinSQL(SQL_COMMA, list_), SQL_SPACE)


def sql_iso(*sql):
    return ConcatSQL(*((SQL_OP,) + sql + (SQL_CP,)))


def sql_count(sql):
    return "COUNT(" + sql + ")"


def sql_concat_text(list_):
    """
    TEXT CONCATENATION WITH "||"
    """
    return JoinSQL(SQL_CONCAT, [sql_iso(l) for l in list_])


def sql_coalesce(list_):
    return ConcatSQL(SQL("COALESCE("), JoinSQL(SQL_COMMA, list_), SQL_CP)
