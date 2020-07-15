# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

from warnings import warn_explicit

from mo_logs.log_usingNothing import StructuredLogger
from mo_logs.strings import expand_template


class StructuredLogger_usingWarn(StructuredLogger):

    def write(self, template, params):
        value = expand_template(template, params)
        warn_explicit(message=value+"\n", category=Warning, filename="", lineno=0)
