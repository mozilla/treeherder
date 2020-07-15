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

from jx_base.expressions.number_op import NumberOp as NumberOp_
from jx_base.expressions.true_op import TRUE
from jx_python.expressions import _utils
from jx_python.expressions._utils import Python
from mo_json import NUMBER_TYPES


class NumberOp(NumberOp_):
    def to_python(self, not_null=False, boolean=False, many=False):
        term = Python[self.term]
        if not_null:
            if term.type in NUMBER_TYPES:
                return term.to_python(not_null=True)
            else:
                return "float(" + Python[self.term].to_python(not_null=True) + ")"
        else:
            exists = self.term.exists()
            value = Python[self.term].to_python(not_null=True)

            if exists is TRUE:
                return "float(" + value + ")"
            else:
                return (
                    "float("
                    + value
                    + ") if ("
                    + Python[exists].to_python()
                    + ") else None"
                )


_utils.NumberOp = NumberOp
