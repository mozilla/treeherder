# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
from __future__ import absolute_import, division, unicode_literals

import logging

from mo_future import is_text
from mo_logs import exceptions
from mo_logs.log_usingNothing import StructuredLogger
from mo_logs.strings import expand_template


# WRAP PYTHON logger OBJECTS
class StructuredLogger_usingLogger(StructuredLogger):
    def __init__(self, settings):
        print("setup logger")
        min_level = settings.min_level
        if min_level == None:
            self.min_level = logging.INFO
        elif is_text(min_level):
            self.min_level = getattr(logging, min_level.upper())
        else:
            self.min_level = min_level

        self.logger = logging.getLogger(settings.name)
        self.logger.setLevel(logging.INFO)

    def write(self, template, params):
        print(template)
        log_line = expand_template(template, params)
        level = max(self.min_level, MAP[params.context])
        self.logger.log(level, log_line)

    def stop(self):
        try:
            self.logger.shutdown()
        except Exception:
            self.logger.info("Failure in the logger shutdown")


MAP = {
    exceptions.ERROR: logging.ERROR,
    exceptions.WARNING: logging.WARNING,
    exceptions.NOTE: logging.INFO
}