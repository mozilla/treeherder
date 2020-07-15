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

from jx_base.expressions._utils import operators, jx_expression, _jx_expression, simplified
from jx_base.language import BaseExpression, ID, is_expression, is_op
from mo_dots import is_data, is_sequence, is_container
from mo_future import items as items_, text
from mo_json import BOOLEAN, OBJECT, value2json
from mo_logs import Log

FALSE, Literal, is_literal, MissingOp, NotOp, NULL, Variable = [None]*7


class Expression(BaseExpression):
    data_type = OBJECT
    has_simple_form = False

    def __init__(self, args):
        self.simplified = False
        # SOME BASIC VERIFICATION THAT THESE ARE REASONABLE PARAMETERS
        if is_sequence(args):
            bad = [t for t in args if t != None and not is_expression(t)]
            if bad:
                Log.error("Expecting an expression, not {{bad}}", bad=bad)
        elif is_data(args):
            if not all(is_op(k, Variable) and is_literal(v) for k, v in args.items()):
                Log.error("Expecting an {<variable>: <literal>}")
        elif args == None:
            pass
        else:
            if not is_expression(args):
                Log.error("Expecting an expression")

    @classmethod
    def get_id(cls):
        return getattr(cls, ID)

    @classmethod
    def define(cls, expr):
        """
        GENERAL SUPPORT FOR BUILDING EXPRESSIONS FROM JSON EXPRESSIONS
        OVERRIDE THIS IF AN OPERATOR EXPECTS COMPLICATED PARAMETERS
        :param expr: Data representing a JSON Expression
        :return: parse tree
        """

        try:
            lang = cls.lang
            items = items_(expr)
            for item in items:
                op, term = item
                full_op = operators.get(op)
                if full_op:
                    class_ = lang.ops[full_op.get_id()]
                    clauses = {k: jx_expression(v) for k, v in expr.items() if k != op}
                    break
            else:
                if not items:
                    return NULL
                raise Log.error(
                    "{{operator|quote}} is not a known operator", operator=expr
                )

            if term == None:
                return class_([], **clauses)
            elif is_container(term):
                terms = [jx_expression(t) for t in term]
                return class_(terms, **clauses)
            elif is_data(term):
                items = items_(term)
                if class_.has_simple_form:
                    if len(items) == 1:
                        k, v = items[0]
                        return class_([Variable(k), Literal(v)], **clauses)
                    else:
                        return class_({k: Literal(v) for k, v in items}, **clauses)
                else:
                    return class_(_jx_expression(term, lang), **clauses)
            else:
                if op in ["literal", "date", "offset"]:
                    return class_(term, **clauses)
                else:
                    return class_(_jx_expression(term, lang), **clauses)
        except Exception as e:
            Log.error("programmer error expr = {{value|quote}}", value=expr, cause=e)

    @property
    def name(self):
        return self.__class__.__name__

    @property
    def many(self):
        """
        :return: True IF THE EXPRESSION RETURNS A MULTIVALUE (WHICH IS NOT A LIST OR A TUPLE)
        """
        return False

    def __data__(self):
        raise NotImplementedError

    def vars(self):
        raise Log.error("{{type}} has no `vars` method", type=self.__class__.__name__)

    def map(self, map):
        raise Log.error("{{type}} has no `map` method", type=self.__class__.__name__)

    def missing(self):
        """
        THERE IS PLENTY OF OPPORTUNITY TO SIMPLIFY missing EXPRESSIONS
        OVERRIDE THIS METHOD TO SIMPLIFY
        :return:
        """
        if self.type == BOOLEAN:
            Log.error("programmer error")
        return self.lang[MissingOp(self)]

    def exists(self):
        """
        THERE IS PLENTY OF OPPORTUNITY TO SIMPLIFY exists EXPRESSIONS
        OVERRIDE THIS METHOD TO SIMPLIFY
        :return:
        """
        return self.lang[NotOp(self.missing())].partial_eval()

    def invert(self):
        """
        :return: TRUE IF FALSE
        """
        return self.lang[NotOp(self)]

    @simplified
    def partial_eval(self):
        """
        ATTEMPT TO SIMPLIFY THE EXPRESSION:
        PREFERABLY RETURNING A LITERAL, BUT MAYBE A SIMPLER EXPRESSION, OR self IF NOT POSSIBLE
        """
        return self

    @property
    def type(self):
        return self.data_type

    def __eq__(self, other):
        if other is None:
            return False
        if self.get_id() != other.get_id():
            return False
        self_class = self.__class__
        Log.note("this is slow on {{type}}", type=text(self_class.__name__))
        return self.__data__() == other.__data__()

    def __str__(self):
        return value2json(self.__data__(), pretty=True)

    def __getattr__(self, item):
        Log.error(
            "{{type}} object has no attribute {{item}}, did you .register_ops() for {{type}}?",
            type=self.__class__.__name__,
            item=item
        )

