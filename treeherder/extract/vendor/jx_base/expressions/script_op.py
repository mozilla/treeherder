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

from jx_base.expressions.expression import Expression
from mo_future import is_text
from mo_json import OBJECT
from mo_logs import Log


class ScriptOp(Expression):
    """
    ONLY FOR WHEN YOU TRUST THE SCRIPT SOURCE
    """

    def __init__(self, script, data_type=OBJECT):
        Expression.__init__(self, None)
        if not is_text(script):
            Log.error("expecting text of a script")
        self.simplified = True
        self.script = script
        self.data_type = data_type

    @classmethod
    def define(cls, expr):
        if ALLOW_SCRIPTING:
            Log.warning(
                "Scripting has been activated:  This has known security holes!!\nscript = {{script|quote}}",
                script=expr.script.term,
            )
            return cls.lang[ScriptOp(expr.script)]
        else:
            Log.error("scripting is disabled")

    def vars(self):
        return set()

    def map(self, map_):
        return self

    def __unicode__(self):
        return self.script

    def __str__(self):
        return str(self.script)
