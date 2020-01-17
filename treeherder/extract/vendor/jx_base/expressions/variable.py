# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http:# mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#

"""
# NOTE:

THE self.lang[operator] PATTERN IS CASTING NEW OPERATORS TO OWN LANGUAGE;
KEEPING Python AS# Python, ES FILTERS AS ES FILTERS, AND Painless AS
Painless. WE COULD COPY partial_eval(), AND OTHERS, TO THIER RESPECTIVE
LANGUAGE, BUT WE KEEP CODE HERE SO THERE IS LESS OF IT

"""
from __future__ import absolute_import, division, unicode_literals

from jx_base.expressions import _utils, expression
from jx_base.expressions.expression import Expression
from jx_base.expressions.false_op import FALSE
from jx_base.expressions.missing_op import MissingOp
from jx_base.language import is_op
from jx_base.utils import get_property_name
from mo_dots import coalesce, is_sequence, split_field
from mo_dots.lists import last
from mo_future import is_text
from mo_json.typed_encoder import inserter_type_to_json_type


class Variable(Expression):
    def __init__(self, var):
        """
        :param var:  DOT DELIMITED PATH INTO A DOCUMENT

        """
        Expression.__init__(self, None)

        # if self.lang != self.__class_.lang:
        #     pass
        self.var = get_property_name(var)
        jx_type = inserter_type_to_json_type.get(last(split_field(var)))
        if jx_type:
            self.data_type = jx_type

    def __call__(self, row, rownum=None, rows=None):
        path = split_field(self.var)
        for p in path:
            row = row.get(p)
            if row is None:
                return None
        if is_sequence(row) and len(row) == 1:
            return row[0]
        return row

    def __data__(self):
        return self.var

    @property
    def many(self):
        return True

    def vars(self):
        return {self}

    def map(self, map_):
        return Variable(coalesce(map_.get(self.var), self.var))

    def __hash__(self):
        return self.var.__hash__()

    def __eq__(self, other):
        if is_op(other, Variable):
            return self.var == other.var
        elif is_text(other):
            return self.var == other
        return False

    def __unicode__(self):
        return self.var

    def __str__(self):
        return str(self.var)

    def missing(self):
        if self.var == "_id":
            return FALSE
        else:
            return self.lang[MissingOp(self)]


IDENTITY = Variable(".")

_utils.Variable = Variable
expression.Variable = Variable
