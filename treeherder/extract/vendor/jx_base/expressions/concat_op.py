# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http:# mozilla.org/MPL/2.0/.
#

from __future__ import absolute_import, division, unicode_literals

from jx_base.expressions._utils import jx_expression
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.literal import Literal
from jx_base.expressions.literal import is_literal
from jx_base.expressions.null_op import NULL
from jx_base.expressions.variable import Variable
from jx_base.language import is_op
from jx_base.utils import is_variable_name
from mo_dots import is_data
from mo_future import first, is_text
from mo_json import STRING
from mo_logs import Log


class ConcatOp(Expression):
    has_simple_form = True
    data_type = STRING

    def __init__(self, terms, **clauses):
        Expression.__init__(self, terms)
        if is_data(terms):
            self.terms = first(terms.items())
        else:
            self.terms = terms
        self.separator = clauses.get(str("separator"), Literal(""))
        self.default = clauses.get(str("default"), NULL)
        if not is_literal(self.separator):
            Log.error("Expecting a literal separator")

    @classmethod
    def define(cls, expr):
        terms = expr["concat"]
        if is_data(terms):
            k, v = first(terms.items())
            terms = [Variable(k), Literal(v)]
        else:
            terms = [jx_expression(t) for t in terms]

        return cls.lang[
            ConcatOp(
                terms,
                **{
                    k: Literal(v)
                    if is_text(v) and not is_variable_name(v)
                    else jx_expression(v)
                    for k, v in expr.items()
                    if k in ["default", "separator"]
                }
            )
        ]

    def __data__(self):
        f, s = self.terms[0], self.terms[1]
        if is_op(f, Variable) and is_literal(s):
            output = {"concat": {f.var: s.value}}
        else:
            output = {"concat": [t.__data__() for t in self.terms]}
        if self.separator.json != '""':
            output["separator"] = self.separator.__data__()
        return output

    def vars(self):
        if not self.terms:
            return set()
        return set.union(*(t.vars() for t in self.terms))

    def map(self, map_):
        return self.lang[
            ConcatOp([t.map(map_) for t in self.terms], separator=self.separator)
        ]

    def missing(self):
        return self.lang[
            AndOp([t.missing() for t in self.terms] + [self.default.missing()])
        ].partial_eval()
