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

from jx_base.expressions import CaseOp as CaseOp_
from jx_python.expressions._utils import Python


class CaseOp(CaseOp_):
    def to_python(self, not_null=False, boolean=False, many=False):
        acc = Python[self.whens[-1]].to_python()
        for w in reversed(self.whens[0:-1]):
            acc = (
                "("
                + Python[w.then].to_python()
                + ") if ("
                + Python[w.when].to_python(boolean=True)
                + ") else ("
                + acc
                + ")"
            )
        return acc
