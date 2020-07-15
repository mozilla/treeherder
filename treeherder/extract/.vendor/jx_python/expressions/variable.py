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

from jx_base.expressions import Variable as Variable_
from mo_dots import split_field
from mo_logs import Log, strings


class Variable(Variable_):
    def to_python(self, not_null=False, boolean=False, many=False):
        path = split_field(self.var)
        agg = "row"
        if not path:
            return agg
        elif path[0] in ["row", "rownum"]:
            # MAGIC VARIABLES
            agg = path[0]
            path = path[1:]
            if len(path) == 0:
                return agg
        elif path[0] == "rows":
            if len(path) == 1:
                return "rows"
            elif path[1] in ["first", "last"]:
                agg = "rows." + path[1] + "()"
                path = path[2:]
            else:
                Log.error("do not know what {{var}} of `rows` is", var=path[1])

        for p in path[:-1]:
            if not_null:
                agg = agg + ".get(" + strings.quote(p) + ")"
            else:
                agg = agg + ".get(" + strings.quote(p) + ", EMPTY_DICT)"
        output = agg + ".get(" + strings.quote(path[-1]) + ")"
        if many:
            output = "listwrap(" + output + ")"
        return output
