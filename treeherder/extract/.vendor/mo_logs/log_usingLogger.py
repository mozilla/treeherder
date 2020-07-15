# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
from __future__ import absolute_import, division, unicode_literals

import logging

from mo_future import is_text, text
from mo_kwargs import override

from mo_logs import exceptions
from mo_logs.log_usingNothing import StructuredLogger
from mo_logs.strings import expand_template


# WRAP PYTHON logger OBJECTS
class StructuredLogger_usingLogger(StructuredLogger):
    @override("settings")
    def __init__(self, name=None, min_level=logging.INFO, settings=None):
        """
        :param name: to find-or-create logger (may break
        :param min_level: increase all logging to this level to get through filters
        """
        if min_level == None:
            self.min_level = logging.INFO
        elif is_text(min_level):
            self.min_level = getattr(logging, min_level.upper())
        else:
            self.min_level = min_level
        self.count = 0
        self.logger = logging.getLogger(name if name else None)
        self.logger.setLevel(logging.NOTSET)

    def write(self, template, params):
        try:
            log_line = expand_template(template, params)
            level = max(self.min_level, MAP[params.context])
            self.logger.log(level, log_line)
            self.count += 1
        except Exception as cause:
            cause = exceptions.Except.wrap(cause)
            import sys
            sys.stderr.write("can not write to logger: "+text(cause))

    def stop(self):
        try:
            self.logger.shutdown()
        except Exception:
            import sys
            sys.stderr.write("Failure in the logger shutdown")


MAP = {
    exceptions.ERROR: logging.ERROR,
    exceptions.WARNING: logging.WARNING,
    exceptions.NOTE: logging.INFO
}