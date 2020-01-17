# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#


from __future__ import absolute_import, division, unicode_literals

import logging

from mo_logs.log_usingNothing import StructuredLogger
from mo_logs.strings import expand_template


# WRAP PYTHON CLASSIC logger OBJECTS
class StructuredLogger_usingLogger(StructuredLogger):
    def __init__(self, settings):
        self.logger = logging.getLogger(settings.name)
        self.logger.setLevel(logging.INFO)

    def write(self, template, params):
        log_line = expand_template(template, params)
        self.logger.info(log_line)
