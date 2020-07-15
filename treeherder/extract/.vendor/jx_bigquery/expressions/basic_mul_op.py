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

from jx_base.expressions import BasicMulOp as BasicMulOp_
from jx_bigquery.expressions._utils import basic_multiop_to_bq


class BasicMulOp(BasicMulOp_):
    to_bq = basic_multiop_to_bq
