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

from jx_base.expressions._utils import simplified, builtin_ops, operators
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.coalesce_op import CoalesceOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.literal import Literal, ZERO, ONE, is_literal
from jx_base.expressions.null_op import NULL
from jx_base.expressions.or_op import OrOp
from jx_base.expressions.true_op import TRUE
from jx_base.expressions.when_op import WhenOp
from mo_dots import coalesce
from mo_json import NUMBER


class BaseMultiOp(Expression):
    has_simple_form = True
    data_type = NUMBER
    op = None

    def __init__(self, terms, **clauses):
        Expression.__init__(self, terms)
        self.terms = terms
        self.default = coalesce(clauses.get("default"), NULL)
        self.nulls = coalesce(
            clauses.get("nulls"), FALSE
        )  # nulls==True WILL HAVE OP RETURN null ONLY IF ALL OPERANDS ARE null

    def __data__(self):
        return {
            self.op: [t.__data__() for t in self.terms],
            "default": self.default,
            "nulls": self.nulls,
        }

    def vars(self):
        output = set()
        for t in self.terms:
            output |= t.vars()
        return output

    def map(self, map_):
        return self.__class__(
            [t.map(map_) for t in self.terms],
            **{"default": self.default, "nulls": self.nulls}
        )

    def missing(self):
        if self.nulls:
            if self.default is NULL:
                return self.lang[AndOp([t.missing() for t in self.terms])]
            else:
                return TRUE
        else:
            if self.default is NULL:
                return self.lang[OrOp([t.missing() for t in self.terms])]
            else:
                return FALSE

    def exists(self):
        if self.nulls:
            return self.lang[OrOp([t.exists() for t in self.terms])]
        else:
            return self.lang[AndOp([t.exists() for t in self.terms])]

    @simplified
    def partial_eval(self):
        acc = None
        terms = []
        for t in self.terms:
            simple = t.partial_eval()
            if simple is NULL:
                pass
            elif is_literal(simple):
                if acc is None:
                    acc = simple.value
                else:
                    acc = builtin_ops[self.op](acc, simple.value)
            else:
                terms.append(simple)

        lang = self.lang
        if len(terms) == 0:
            if acc == None:
                return self.default.partial_eval()
            else:
                return lang[Literal(acc)]
        elif self.nulls:
            # DECISIVE
            if acc is not None:
                terms.append(Literal(acc))

            output = lang[
                WhenOp(
                    AndOp([t.missing() for t in terms]),
                    **{
                        "then": self.default,
                        "else": operators["basic." + self.op](
                            [CoalesceOp([t, _jx_identity[self.op]]) for t in terms]
                        ),
                    }
                )
            ].partial_eval()
        else:
            # CONSERVATIVE
            if acc is not None:
                terms.append(lang[Literal(acc)])

            output = lang[
                WhenOp(
                    lang[OrOp([t.missing() for t in terms])],
                    **{
                        "then": self.default,
                        "else": operators["basic." + self.op](terms),
                    }
                )
            ].partial_eval()

        return output


_jx_identity = {"add": ZERO, "mul": ONE}
