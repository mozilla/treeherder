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

from jx_base.expressions import (
    FALSE,
    NULL,
    ONE,
    PythonScript as PythonScript_,
    TRUE,
    ZERO,
    Expression,
)
from jx_python.expressions import _utils
from mo_dots import coalesce
from mo_future import PY2, text
from mo_logs import Log


class PythonScript(PythonScript_):
    __slots__ = ("miss", "data_type", "expr", "frum", "many")

    def __init__(self, type, expr, frum, miss=None, many=False):
        Expression.__init__(self, None)
        if miss not in [None, NULL, FALSE, TRUE, ONE, ZERO]:
            if frum.lang != miss.lang:
                Log.error("logic error")

        self.miss = coalesce(
            miss, FALSE
        )  # Expression that will return true/false to indicate missing result
        self.data_type = type
        self.expr = expr
        self.many = many  # True if script returns multi-value
        self.frum = frum  # THE ORIGINAL EXPRESSION THAT MADE expr

    @property
    def type(self):
        return self.data_type

    def __str__(self):
        missing = self.miss.partial_eval()
        if missing is FALSE:
            return self.partial_eval().to_python().expr
        elif missing is TRUE:
            return "None"

        return "None if (" + missing.to_python().expr + ") else (" + self.expr + ")"

    def __add__(self, other):
        return text(self) + text(other)

    def __radd__(self, other):
        return text(other) + text(self)

    if PY2:
        __unicode__ = __str__

    def to_python(self, not_null=False, boolean=False, many=True):
        return self

    def missing(self):
        return self.miss

    def __data__(self):
        return {"script": self.script}

    def __eq__(self, other):
        if not isinstance(other, PythonScript_):
            return False
        elif self.expr == other.expr:
            return True
        else:
            return False

_utils.PythonScript = PythonScript