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

from jx_base.expressions.expression import Expression
from mo_json import NUMBER


class UnixOp(Expression):
    """
    FOR USING ON DATABASES WHICH HAVE A DATE COLUMNS: CONVERT TO UNIX
    """

    has_simple_form = True
    data_type = NUMBER

    def __init__(self, term):
        Expression.__init__(self, term)
        self.value = term

    def vars(self):
        return self.value.vars()

    def map(self, map_):
        return self.lang[UnixOp(self.value.map(map_))]

    def missing(self):
        return self.value.missing()
