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

import os
import platform
import sys
from datetime import datetime

from mo_dots import Data, FlatList, coalesce, is_list, listwrap, unwraplist, dict_to_data, is_data
from mo_future import PY3, is_text, text
from mo_kwargs import override
from mo_logs import constants as _constants, exceptions, strings, startup
from mo_logs.exceptions import Except, LogItem, suppress_exception
from mo_logs.strings import CR, indent

_Thread = None
if PY3:
    STDOUT = sys.stdout.buffer
else:
    STDOUT = sys.stdout


class Log(object):
    """
    FOR STRUCTURED LOGGING AND EXCEPTION CHAINING
    """
    trace = False
    main_log = None
    logging_multi = None
    profiler = None   # simple pypy-friendly profiler
    error_mode = False  # prevent error loops

    @classmethod
    @override("settings")
    def start(cls, trace=False, cprofile=False, constants=None, logs=None, app_name=None, settings=None):
        """
        RUN ME FIRST TO SETUP THE THREADED LOGGING
        https://fangpenlin.com/posts/2012/08/26/good-logging-practice-in-python/

        :param trace: SHOW MORE DETAILS IN EVERY LOG LINE (default False)
        :param cprofile: True==ENABLE THE C-PROFILER THAT COMES WITH PYTHON (default False)
                         USE THE LONG FORM TO SET THE FILENAME {"enabled": True, "filename": "cprofile.tab"}
        :param constants: UPDATE MODULE CONSTANTS AT STARTUP (PRIMARILY INTENDED TO CHANGE DEBUG STATE)
        :param logs: LIST OF PARAMETERS FOR LOGGER(S)
        :param app_name: GIVE THIS APP A NAME, AND RETURN A CONTEXT MANAGER
        :param settings: ALL THE ABOVE PARAMTERS
        :return:
        """
        global _Thread  # REQUIRED FOR trace
        if app_name:
            return LoggingContext(app_name)

        Log.stop()

        cls.settings = settings
        cls.trace = trace
        if trace:
            from mo_threads import Thread as _Thread
            _ = _Thread

        # ENABLE CPROFILE
        if cprofile is False:
            cprofile = settings.cprofile = Data(enabled=False)
        elif cprofile is True:
            cprofile = settings.cprofile = Data(enabled=True, filename="cprofile.tab")
        if is_data(cprofile) and cprofile.enabled:
            from mo_threads import profiles
            profiles.enable_profilers(settings.cprofile.filename)

        if constants:
            _constants.set(constants)

        logs = coalesce(settings.log, logs)
        if logs:
            cls.logging_multi = StructuredLogger_usingMulti()
            for log in listwrap(logs):
                Log._add_log(Log.new_instance(log))

            from mo_logs.log_usingThread import StructuredLogger_usingThread
            old_log, cls.main_log = cls.main_log, StructuredLogger_usingThread(cls.logging_multi)
            old_log.stop()

    @classmethod
    def stop(cls):
        """
        DECONSTRUCTS ANY LOGGING, AND RETURNS TO DIRECT-TO-stdout LOGGING
        EXECUTING MULUTIPLE TIMES IN A ROW IS SAFE, IT HAS NO NET EFFECT, IT STILL LOGS TO stdout
        :return: NOTHING
        """
        old_log, cls.main_log = cls.main_log, StructuredLogger_usingStream(STDOUT)
        old_log.stop()

    @classmethod
    @override("settings")
    def new_instance(cls, log_type=None, settings=None):
        if settings["class"]:
            if settings["class"].startswith("logging.handlers."):
                from mo_logs.log_usingThread import StructuredLogger_usingThread
                from mo_logs.log_usingHandler import StructuredLogger_usingHandler

                return StructuredLogger_usingThread(StructuredLogger_usingHandler(settings))
            else:
                with suppress_exception:
                    from mo_logs.log_usingLogger import make_log_from_settings

                    return make_log_from_settings(settings)
                # OH WELL :(

        if log_type == "logger":
            from mo_logs.log_usingLogger import StructuredLogger_usingLogger
            return StructuredLogger_usingLogger(settings)
        if log_type == "file" or settings.file:
            return StructuredLogger_usingFile(settings.file)
        if log_type == "file" or settings.filename:
            return StructuredLogger_usingFile(settings.filename)
        if log_type == "console":
            from mo_logs.log_usingThread import StructuredLogger_usingThread
            return StructuredLogger_usingThread(StructuredLogger_usingStream(STDOUT))
        if log_type == "print":
            from mo_logs.log_usingThread import StructuredLogger_usingThread
            from mo_logs.log_usingPrint import StructuredLogger_usingPrint
            return StructuredLogger_usingThread(StructuredLogger_usingPrint())
        if log_type == "mozlog":
            from mo_logs.log_usingMozLog import StructuredLogger_usingMozLog
            return StructuredLogger_usingMozLog(STDOUT, coalesce(settings.app_name, settings.appname))
        if log_type == "stream" or settings.stream:
            from mo_logs.log_usingThread import StructuredLogger_usingThread
            return StructuredLogger_usingThread(StructuredLogger_usingStream(settings.stream))
        if log_type == "elasticsearch" or settings.stream:
            from mo_logs.log_usingElasticSearch import StructuredLogger_usingElasticSearch
            return StructuredLogger_usingElasticSearch(settings)
        if log_type == "email":
            from mo_logs.log_usingEmail import StructuredLogger_usingEmail
            return StructuredLogger_usingEmail(settings)
        if log_type == "ses":
            from mo_logs.log_usingSES import StructuredLogger_usingSES
            return StructuredLogger_usingSES(settings)
        if log_type.lower() in ["nothing", "none", "null"]:
            from mo_logs.log_usingNothing import StructuredLogger
            return StructuredLogger()

        Log.error("Log type of {{config|json}} is not recognized", config=settings)

    @classmethod
    def _add_log(cls, log):
        cls.logging_multi.add_log(log)

    @classmethod
    def set_logger(cls, logger):
        if cls.logging_multi:
            cls.logging_multi.add_log(logger)
        else:
            from mo_logs.log_usingThread import StructuredLogger_usingThread
            old_log, cls.main_log = cls.main_log, StructuredLogger_usingThread(logger)
            old_log.stop()

    @classmethod
    def note(
        cls,
        template,
        default_params={},
        stack_depth=0,
        log_context=None,
        **more_params
    ):
        """
        :param template: *string* human readable string with placeholders for parameters
        :param default_params: *dict* parameters to fill in template
        :param stack_depth:  *int* how many calls you want popped off the stack to report the *true* caller
        :param log_context: *dict* extra key:value pairs for your convenience
        :param more_params: *any more parameters (which will overwrite default_params)
        :return:
        """
        timestamp = datetime.utcnow()
        if not is_text(template):
            Log.error("Log.note was expecting a unicode template")

        Log._annotate(
            LogItem(
                context=exceptions.NOTE,
                format=template,
                template=template,
                params=dict(default_params, **more_params)
            ),
            timestamp,
            stack_depth+1
        )

    @classmethod
    def unexpected(
        cls,
        template,
        default_params={},
        cause=None,
        stack_depth=0,
        log_context=None,
        **more_params
    ):
        """
        :param template: *string* human readable string with placeholders for parameters
        :param default_params: *dict* parameters to fill in template
        :param cause: *Exception* for chaining
        :param stack_depth:  *int* how many calls you want popped off the stack to report the *true* caller
        :param log_context: *dict* extra key:value pairs for your convenience
        :param more_params: *any more parameters (which will overwrite default_params)
        :return:
        """
        timestamp = datetime.utcnow()
        if not is_text(template):
            Log.error("Log.warning was expecting a unicode template")

        if isinstance(default_params, BaseException):
            cause = default_params
            default_params = {}

        if "values" in more_params.keys():
            Log.error("Can not handle a logging parameter by name `values`")

        params = Data(dict(default_params, **more_params))
        cause = unwraplist([Except.wrap(c) for c in listwrap(cause)])
        trace = exceptions.get_stacktrace(stack_depth + 1)

        e = Except(exceptions.UNEXPECTED, template=template, params=params, cause=cause, trace=trace)
        Log._annotate(
            e,
            timestamp,
            stack_depth+1
        )

    @classmethod
    def alarm(
        cls,
        template,
        default_params={},
        stack_depth=0,
        log_context=None,
        **more_params
    ):
        """
        :param template: *string* human readable string with placeholders for parameters
        :param default_params: *dict* parameters to fill in template
        :param stack_depth:  *int* how many calls you want popped off the stack to report the *true* caller
        :param log_context: *dict* extra key:value pairs for your convenience
        :param more_params: more parameters (which will overwrite default_params)
        :return:
        """
        timestamp = datetime.utcnow()
        format = ("*" * 80) + CR + indent(template, prefix="** ").strip() + CR + ("*" * 80)
        Log._annotate(
            LogItem(
                context=exceptions.ALARM,
                format=format,
                template=template,
                params=dict(default_params, **more_params)
            ),
            timestamp,
            stack_depth + 1
        )

    alert = alarm

    @classmethod
    def warning(
        cls,
        template,
        default_params={},
        cause=None,
        stack_depth=0,
        log_context=None,
        **more_params
    ):
        """
        :param template: *string* human readable string with placeholders for parameters
        :param default_params: *dict* parameters to fill in template
        :param cause: *Exception* for chaining
        :param stack_depth:  *int* how many calls you want popped off the stack to report the *true* caller
        :param log_context: *dict* extra key:value pairs for your convenience
        :param more_params: *any more parameters (which will overwrite default_params)
        :return:
        """
        timestamp = datetime.utcnow()
        if not is_text(template):
            Log.error("Log.warning was expecting a unicode template")

        if isinstance(default_params, BaseException):
            cause = default_params
            default_params = {}

        if "values" in more_params.keys():
            Log.error("Can not handle a logging parameter by name `values`")

        params = Data(dict(default_params, **more_params))
        cause = unwraplist([Except.wrap(c) for c in listwrap(cause)])
        trace = exceptions.get_stacktrace(stack_depth + 1)

        e = Except(exceptions.WARNING, template=template, params=params, cause=cause, trace=trace)
        Log._annotate(
            e,
            timestamp,
            stack_depth+1
        )

    @classmethod
    def error(
        cls,
        template,  # human readable template
        default_params={},  # parameters for template
        cause=None,  # pausible cause
        stack_depth=0,
        **more_params
    ):
        """
        raise an exception with a trace for the cause too

        :param template: *string* human readable string with placeholders for parameters
        :param default_params: *dict* parameters to fill in template
        :param cause: *Exception* for chaining
        :param stack_depth:  *int* how many calls you want popped off the stack to report the *true* caller
        :param log_context: *dict* extra key:value pairs for your convenience
        :param more_params: *any more parameters (which will overwrite default_params)
        :return:
        """
        if not is_text(template):
            sys.stderr.write(str("Log.error was expecting a unicode template"))
            Log.error("Log.error was expecting a unicode template")

        if default_params and isinstance(listwrap(default_params)[0], BaseException):
            cause = default_params
            default_params = {}

        params = Data(dict(default_params, **more_params))

        add_to_trace = False
        if cause == None:
            causes = None
        elif is_list(cause):
            causes = []
            for c in listwrap(cause):  # CAN NOT USE LIST-COMPREHENSION IN PYTHON3 (EXTRA STACK DEPTH FROM THE IN-LINED GENERATOR)
                causes.append(Except.wrap(c, stack_depth=1))
            causes = FlatList(causes)
        elif isinstance(cause, BaseException):
            causes = Except.wrap(cause, stack_depth=1)
        else:
            causes = None
            Log.error("can only accept Exception, or list of exceptions")

        trace = exceptions.get_stacktrace(stack_depth + 1)

        if add_to_trace:
            cause[0].trace.extend(trace[1:])

        e = Except(context=exceptions.ERROR, template=template, params=params, cause=causes, trace=trace)
        raise_from_none(e)

    @classmethod
    def _annotate(
        cls,
        item,
        timestamp,
        stack_depth
    ):
        """
        :param itemt:  A LogItemTHE TYPE OF MESSAGE
        :param stack_depth: FOR TRACKING WHAT LINE THIS CAME FROM
        :return:
        """
        item.timestamp = timestamp
        item.machine = machine_metadata
        item.template = strings.limit(item.template, 10000)

        item.format = strings.limit(item.format, 10000)
        if item.format == None:
            format = text(item)
        else:
            format = item.format.replace("{{", "{{params.")
        if not format.startswith(CR) and format.find(CR) > -1:
            format = CR + format

        if cls.trace:
            log_format = item.format = "{{machine.name}} (pid {{machine.pid}}) - {{timestamp|datetime}} - {{thread.name}} - \"{{location.file}}:{{location.line}}\" - ({{location.method}}) - " + format
            f = sys._getframe(stack_depth + 1)
            item.location = {
                "line": f.f_lineno,
                "file": text(f.f_code.co_filename),
                "method": text(f.f_code.co_name)
            }
            thread = _Thread.current()
            item.thread = {"name": thread.name, "id": thread.id}
        else:
            log_format = item.format = "{{timestamp|datetime}} - " + format

        cls.main_log.write(log_format, item.__data__())

    def write(self):
        raise NotImplementedError


class LoggingContext:

    def __init__(self, app_name):
        self.app_name = app_name
        self.config = None

    def __enter__(self):
        self.config = config = startup.read_settings()
        constants.set(config.constants)
        Log.start(config.debug)
        return config

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_val:
            Log.warning("Problem with {{name}}! Shutting down.", name=self.app_name, cause=exc_val)
        Log.stop()


def _same_frame(frameA, frameB):
    return (frameA.line, frameA.file) == (frameB.line, frameB.file)


# GET THE MACHINE METADATA
machine_metadata = dict_to_data({
    "pid":  os.getpid(),
    "python": text(platform.python_implementation()),
    "os": text(platform.system() + platform.release()).strip(),
    "name": text(platform.node())
})


def raise_from_none(e):
    raise e


if PY3:
    exec("def raise_from_none(e):\n    raise e from None\n", globals(), locals())

from mo_logs import startup
from mo_logs.log_usingFile import StructuredLogger_usingFile
from mo_logs.log_usingMulti import StructuredLogger_usingMulti
from mo_logs.log_usingStream import StructuredLogger_usingStream

# EXPORT
startup.Log = Log


if not Log.main_log:
    Log.main_log = StructuredLogger_usingStream(STDOUT)


