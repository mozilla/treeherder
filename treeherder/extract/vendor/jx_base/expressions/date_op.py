# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http:# mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#

"""
# NOTE:

THE self.lang[operator] PATTERN IS CASTING NEW OPERATORS TO OWN LANGUAGE;
KEEPING Python AS# Python, ES FILTERS AS ES FILTERS, AND Painless AS
Painless. WE COULD COPY partial_eval(), AND OTHERS, TO THIER RESPECTIVE
LANGUAGE, BUT WE KEEP CODE HERE SO THERE IS LESS OF IT

"""
from __future__ import absolute_import, division, unicode_literals

from jx_base.expressions import literal
from jx_base.expressions.literal import Literal
from mo_dots import coalesce
from mo_future import is_text
from mo_json import NUMBER
from mo_times.dates import unicode2Date, Date


class DateOp(Literal):
    date_type = NUMBER

    def __init__(self, term):
        if hasattr(self, "date"):
            return
        if is_text(term):
            self.date = term
        else:
            self.date = coalesce(term.get("literal"), term)
        v = unicode2Date(self.date)
        if isinstance(v, Date):
            Literal.__init__(self, v.unix)
        else:
            Literal.__init__(self, v.seconds)

    @classmethod
    def define(cls, expr):
        return cls.lang[DateOp(expr.get("date"))]

    def __data__(self):
        return {"date": self.date}

    def __call__(self, row=None, rownum=None, rows=None):
        return Date(self.date)


literal.DateOp=DateOp