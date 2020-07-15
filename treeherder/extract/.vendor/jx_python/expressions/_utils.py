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

from jx_python.expression_compiler import compile_expression

from jx_base.expressions import (
    FALSE,
    NULL,
    NullOp,
    extend,
    jx_expression,
)
from jx_base.language import Language, is_expression, is_op
from mo_dots import is_data, is_list, Null
from mo_future import is_text
from mo_json import BOOLEAN

NumberOp, OrOp, PythonScript, ScriptOp, WhenOp = [None]*5


def jx_expression_to_function(expr):
    """
    RETURN FUNCTION THAT REQUIRES PARAMETERS (row, rownum=None, rows=None):
    """
    if expr == None:
        return Null

    if is_expression(expr):
        # ALREADY AN EXPRESSION OBJECT
        if is_op(expr, ScriptOp) and not is_text(expr.script):
            return expr.script
        else:
            func = compile_expression(Python[expr].to_python())
            return JXExpression(func, expr.__data__())
    if (
        not is_data(expr)
        and not is_list(expr)
        and hasattr(expr, "__call__")
    ):
        # THIS APPEARS TO BE A FUNCTION ALREADY
        return expr

    expr = jx_expression(expr)
    func = compile_expression(Python[expr].to_python())
    return JXExpression(func, expr)


class JXExpression(object):
    def __init__(self, func, expr):
        self.func = func
        self.expr = expr

    def __call__(self, *args, **kwargs):
        return self.func(*args)

    def __str__(self):
        return str(self.expr.__data__())

    def __repr__(self):
        return repr(self.expr.__data__())

    def __data__(self):
        return self.expr.__data__()


@extend(NullOp)
def to_python(self, not_null=False, boolean=False, many=False):
    return "None"


def _inequality_to_python(self, not_null=False, boolean=False, many=True):
    op, identity = _python_operators[self.op]
    lhs = NumberOp(self.lhs).partial_eval().to_python(not_null=True)
    rhs = NumberOp(self.rhs).partial_eval().to_python(not_null=True)
    script = "(" + lhs + ") " + op + " (" + rhs + ")"

    output = (
        WhenOp(
            OrOp([self.lhs.missing(), self.rhs.missing()]),
            **{
                "then": FALSE,
                "else": PythonScript(type=BOOLEAN, expr=script, frum=self),
            }
        )
        .partial_eval()
        .to_python()
    )
    return output


def _binaryop_to_python(self, not_null=False, boolean=False, many=True):
    op, identity = _python_operators[self.op]

    lhs = NumberOp(self.lhs).partial_eval().to_python(not_null=True)
    rhs = NumberOp(self.rhs).partial_eval().to_python(not_null=True)
    script = "(" + lhs + ") " + op + " (" + rhs + ")"
    missing = OrOp([self.lhs.missing(), self.rhs.missing()]).partial_eval()
    if missing is FALSE:
        return script
    else:
        return "(None) if (" + missing.to_python() + ") else (" + script + ")"


def multiop_to_python(self, not_null=False, boolean=False, many=False):
    sign, zero = _python_operators[self.op]
    if len(self.terms) == 0:
        return Python[self.default].to_python()
    elif self.default is NULL:
        return sign.join(
            "coalesce(" + Python[t].to_python() + ", " + zero + ")" for t in self.terms
        )
    else:
        return (
            "coalesce("
            + sign.join("(" + Python[t].to_python() + ")" for t in self.terms)
            + ", "
            + Python[self.default].to_python()
            + ")"
        )


def with_var(var, expression, eval):
    """
    :param var: NAME GIVEN TO expression
    :param expression: THE EXPRESSION TO COMPUTE FIRST
    :param eval: THE EXPRESSION TO COMPUTE SECOND, WITH var ASSIGNED
    :return: PYTHON EXPRESSION
    """
    return "[(" + eval + ") for " + var + " in [" + expression + "]][0]"


Python = Language("Python")


_python_operators = {
    "add": (" + ", "0"),  # (operator, zero-array default value) PAIR
    "sum": (" + ", "0"),
    "mul": (" * ", "1"),
    "sub": (" - ", None),
    "div": (" / ", None),
    "exp": (" ** ", None),
    "mod": (" % ", None),
    "gt": (" > ", None),
    "gte": (" >= ", None),
    "lte": (" <= ", None),
    "lt": (" < ", None),
}
