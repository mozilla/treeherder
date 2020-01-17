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

from jx_base.expressions import LeavesOp as LeavesOp_
from jx_base.language import is_op
from jx_bigquery.expressions._utils import check
from jx_bigquery.expressions.variable import Variable
from mo_dots import join_field, split_field, startswith_field, wrap
from mo_json import EXISTS, NESTED, OBJECT
from mo_logs import Log


class LeavesOp(LeavesOp_):
    @check
    def to_bq(self, schema, not_null=False, boolean=False):
        if not is_op(self.term, Variable):
            Log.error("Can only handle Variable")
        term = self.term.var
        prefix_length = len(split_field(term))
        output = wrap(
            [
                {
                    "name": join_field(
                        split_field(schema.get_column_name(c))[prefix_length:]
                    ),
                    "sql": Variable(schema.get_column_name(c)).to_bq(schema)[0].sql,
                }
                for c in schema.columns
                if startswith_field(c.name, term)
                and (
                    (
                        c.jx_type not in (EXISTS, OBJECT, NESTED)
                        and startswith_field(schema.nested_path[0], c.nested_path[0])
                    )
                    or (
                        c.jx_type not in (EXISTS, OBJECT)
                        and schema.nested_path[0] == c.nested_path[0]
                    )
                )
            ]
        )
        return output
