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

from jx_base.expressions import FindOp as FindOp_, simplified
from jx_python.expressions._utils import with_var, Python
from jx_python.expressions.and_op import AndOp
from jx_python.expressions.basic_eq_op import BasicEqOp
from jx_python.expressions.basic_index_of_op import BasicIndexOfOp
from jx_python.expressions.eq_op import EqOp
from jx_python.expressions.literal import Literal
from jx_python.expressions.or_op import OrOp
from jx_python.expressions.when_op import WhenOp


class FindOp(FindOp_):
    @simplified
    def partial_eval(self):
        index = self.lang[
            BasicIndexOfOp([self.value, self.find, self.start])
        ].partial_eval()

        output = self.lang[
            WhenOp(
                OrOp(
                    [
                        self.value.missing(),
                        self.find.missing(),
                        BasicEqOp([index, Literal(-1)]),
                    ]
                ),
                **{"then": self.default, "else": index}
            )
        ].partial_eval()
        return output

    def missing(self):
        output = AndOp(
            [
                self.default.missing(),
                OrOp(
                    [
                        self.value.missing(),
                        self.find.missing(),
                        EqOp(
                            [
                                BasicIndexOfOp([self.value, self.find, self.start]),
                                Literal(-1),
                            ]
                        ),
                    ]
                ),
            ]
        ).partial_eval()
        return output

    def to_python(self, not_null=False, boolean=False, many=False):
        return with_var(
            "f",
            "("
            + Python[self.value].to_python()
            + ").find"
            + "("
            + Python[self.find].to_python()
            + ")",
            "None if f==-1 else f",
        )
