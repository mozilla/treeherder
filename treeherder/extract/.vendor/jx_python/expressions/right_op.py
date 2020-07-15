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

from jx_base.expressions import RightOp as RightOp_
from jx_python.expressions._utils import Python, with_var


class RightOp(RightOp_):
    def to_python(self, not_null=False, boolean=False, many=False):
        v = Python[self.value].to_python()
        l = Python[self.length].to_python()

        return with_var("v", v, "None if v == None else v[max(0, len(v)-int(" + l + ")):]")
