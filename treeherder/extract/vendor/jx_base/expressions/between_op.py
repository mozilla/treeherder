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

from jx_base.expressions._utils import jx_expression, simplified
from jx_base.expressions.add_op import AddOp
from jx_base.expressions.basic_substring_op import BasicSubstringOp
from jx_base.expressions.case_op import CaseOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.find_op import FindOp
from jx_base.expressions.is_number_op import IsNumberOp
from jx_base.expressions.length_op import LengthOp
from jx_base.expressions.literal import Literal, ZERO, is_literal
from jx_base.expressions.max_op import MaxOp
from jx_base.expressions.min_op import MinOp
from jx_base.expressions.null_op import NULL
from jx_base.expressions.variable import Variable
from jx_base.expressions.when_op import WhenOp
from jx_base.language import is_op
from mo_dots import is_data, is_sequence, wrap
from mo_json import STRING
from mo_logs import Log


class BetweenOp(Expression):
    data_type = STRING

    def __init__(self, value, prefix, suffix, default=NULL, start=NULL):
        Expression.__init__(self, [])
        self.value = value
        self.prefix = prefix
        self.suffix = suffix
        self.default = default
        self.start = start
        if is_literal(self.prefix) and is_literal(self.suffix):
            pass
        else:
            Log.error("Expecting literal prefix and suffix only")

    @classmethod
    def define(cls, expr):
        term = expr.between
        if is_sequence(term):
            return cls.lang[
                BetweenOp(
                    value=jx_expression(term[0]),
                    prefix=jx_expression(term[1]),
                    suffix=jx_expression(term[2]),
                    default=jx_expression(expr.default),
                    start=jx_expression(expr.start),
                )
            ]
        elif is_data(term):
            var, vals = term.items()[0]
            if is_sequence(vals) and len(vals) == 2:
                return cls.lang[
                    BetweenOp(
                        value=Variable(var),
                        prefix=Literal(vals[0]),
                        suffix=Literal(vals[1]),
                        default=jx_expression(expr.default),
                        start=jx_expression(expr.start),
                    )
                ]
            else:
                Log.error(
                    "`between` parameters are expected to be in {var: [prefix, suffix]} form"
                )
        else:
            Log.error(
                "`between` parameters are expected to be in {var: [prefix, suffix]} form"
            )

    def vars(self):
        return (
            self.value.vars()
            | self.prefix.vars()
            | self.suffix.vars()
            | self.default.vars()
            | self.start.vars()
        )

    def map(self, map_):
        return BetweenOp(
            self.value.map(map_),
            self.prefix.map(map_),
            self.suffix.map(map_),
            default=self.default.map(map_),
            start=self.start.map(map_),
        )

    def __data__(self):
        if (
            is_op(self.value, Variable)
            and is_literal(self.prefix)
            and is_literal(self.suffix)
        ):
            output = wrap(
                {"between": {self.value.var: [self.prefix.value, self.suffix.value]}}
            )
        else:
            output = wrap(
                {
                    "between": [
                        self.value.__data__(),
                        self.prefix.__data__(),
                        self.suffix.__data__(),
                    ]
                }
            )
        if self.start:
            output.start = self.start.__data__()
        if self.default:
            output.default = self.default.__data__()
        return output

    @simplified
    def partial_eval(self):
        value = self.value.partial_eval()

        start_index = self.lang[
            CaseOp(
                [
                    WhenOp(self.prefix.missing(), **{"then": ZERO}),
                    WhenOp(
                        IsNumberOp(self.prefix), **{"then": MaxOp([ZERO, self.prefix])}
                    ),
                    FindOp([value, self.prefix], start=self.start),
                ]
            )
        ].partial_eval()

        len_prefix = self.lang[
            CaseOp(
                [
                    WhenOp(self.prefix.missing(), **{"then": ZERO}),
                    WhenOp(IsNumberOp(self.prefix), **{"then": ZERO}),
                    LengthOp(self.prefix),
                ]
            )
        ].partial_eval()

        end_index = self.lang[
            CaseOp(
                [
                    WhenOp(start_index.missing(), **{"then": NULL}),
                    WhenOp(self.suffix.missing(), **{"then": LengthOp(value)}),
                    WhenOp(
                        IsNumberOp(self.suffix),
                        **{"then": MinOp([self.suffix, LengthOp(value)])}
                    ),
                    FindOp(
                        [value, self.suffix], start=AddOp([start_index, len_prefix])
                    ),
                ]
            )
        ].partial_eval()

        start_index = AddOp([start_index, len_prefix]).partial_eval()
        substring = BasicSubstringOp([value, start_index, end_index]).partial_eval()

        between = self.lang[
            WhenOp(end_index.missing(), **{"then": self.default, "else": substring})
        ].partial_eval()

        return between
