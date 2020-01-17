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

from jx_base.expressions.expression import jx_expression, Expression, _jx_expression
from jx_base.utils import is_variable_name
from mo_dots import wrap, is_container
from mo_future import is_text
from mo_logs import Log
from mo_math import UNION


class SelectOp(Expression):
    has_simple_form = True

    def __init__(self, terms):
        """
        :param terms: list OF {"name":name, "value":value} DESCRIPTORS
        """
        self.terms = terms

    @classmethod
    def define(cls, expr):
        expr = wrap(expr)
        term = expr.select
        terms = []
        if not is_container(term):
            raise Log.error("Expecting a list")
        for t in term:
            if is_text(t):
                if not is_variable_name(t):
                    Log.error(
                        "expecting {{value}} a simple dot-delimited path name", value=t
                    )
                terms.append({"name": t, "value": _jx_expression(t, cls.lang)})
            elif t.name == None:
                if t.value == None:
                    Log.error(
                        "expecting select parameters to have name and value properties"
                    )
                elif is_text(t.value):
                    if not is_variable_name(t):
                        Log.error(
                            "expecting {{value}} a simple dot-delimited path name",
                            value=t.value,
                        )
                    else:
                        terms.append(
                            {
                                "name": t.value,
                                "value": _jx_expression(t.value, cls.lang),
                            }
                        )
                else:
                    Log.error("expecting a name property")
            else:
                terms.append({"name": t.name, "value": jx_expression(t.value)})
        return cls.lang[SelectOp(terms)]

    def __data__(self):
        return {
            "select": [
                {"name": t.name.__data__(), "value": t.value.__data__()}
                for t in self.terms
            ]
        }

    def vars(self):
        return UNION(t.value for t in self.terms)

    def map(self, map_):
        return SelectOp(
            [{"name": t.name, "value": t.value.map(map_)} for t in self.terms]
        )
