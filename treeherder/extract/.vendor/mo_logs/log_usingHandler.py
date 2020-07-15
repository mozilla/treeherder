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

import logging

from mo_logs.strings import expand_template

from mo_dots import unwrap, Null
from mo_logs import Log
from mo_logs.exceptions import suppress_exception
from mo_logs.log_usingNothing import StructuredLogger
from mo_logs.log_usingThreadedStream import StructuredLogger_usingThreadedStream, time_delta_pusher

_THREAD_STOP, _Queue, _Thread = [Null] * 3  # IMPORTS


def _late_import():
    global _THREAD_STOP
    global _Queue
    global _Thread

    from mo_threads import THREAD_STOP as _THREAD_STOP
    from mo_threads import Queue as _Queue
    from mo_threads import Thread as _Thread

    _ = _THREAD_STOP
    _ = _Queue
    _ = _Thread


# WRAP PYTHON CLASSIC logger OBJECTS
class StructuredLogger_usingHandler(StructuredLogger):
    def __init__(self, settings):
        if not _Thread:
            _late_import()

        self.logger = logging.Logger("unique name", level=logging.INFO)
        self.logger.addHandler(make_log_from_settings(settings))

    def write(self, template, params):
        expanded = expand_template(template, params)
        self.logger.info(expanded)

    def stop(self):
        self.logger.shutdown()


def make_log_from_settings(settings):
    assert settings["class"]

    settings = settings.copy()

    # IMPORT MODULE FOR HANDLER
    path = settings["class"].split(".")
    class_name = path[-1]
    path = ".".join(path[:-1])
    constructor = None
    try:
        temp = __import__(path, globals(), locals(), [class_name], 0)
        constructor = object.__getattribute__(temp, class_name)
    except Exception as e:
        if settings.stream and not constructor:
            # PROVIDE A DEFAULT STREAM HANLDER
            constructor = StructuredLogger_usingThreadedStream
        else:
            Log.error("Can not find class {{class}}",  {"class": path}, cause=e)

    # IF WE NEED A FILE, MAKE SURE DIRECTORY EXISTS
    if settings.filename != None:
        from mo_files import File

        f = File(settings.filename)
        if not f.parent.exists:
            f.parent.create()

    settings['class'] = None
    params = unwrap(settings)
    log_instance = constructor(**params)
    return log_instance
