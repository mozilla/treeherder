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

from jx_base.expressions._utils import operators
from jx_base.expressions.and_op import AndOp
from jx_base.expressions.expression import Expression
from jx_base.expressions.literal import Literal
from mo_json import BOOLEAN
from mo_logs import Log


class RangeOp(Expression):
    has_simple_form = True
    data_type = BOOLEAN

    def __new__(cls, term, *args):
        Expression.__new__(cls, *args)
        field, comparisons = term  # comparisons IS A Literal()
        return cls.lang[
            AndOp(
                [
                    getattr(cls.lang, operators[op])([field, Literal(value)])
                    for op, value in comparisons.value.items()
                ]
            )
        ]

    def __init__(self, term):
        Log.error("Should never happen!")
