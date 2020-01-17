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

from jx_base.expressions import RowsOp as RowsOp_
from jx_python.expressions._utils import Python
from jx_python.expressions.integer_op import IntegerOp
from mo_dots import split_field
from mo_json import json2value
from mo_logs import strings


class RowsOp(RowsOp_):
    def to_python(self, not_null=False, boolean=False, many=False):
        agg = "rows[rownum+" + Python[IntegerOp(self.offset)].to_python() + "]"
        path = split_field(json2value(self.var.json))
        if not path:
            return agg

        for p in path[:-1]:
            agg = agg + ".get(" + strings.quote(p) + ", EMPTY_DICT)"
        return agg + ".get(" + strings.quote(path[-1]) + ")"
