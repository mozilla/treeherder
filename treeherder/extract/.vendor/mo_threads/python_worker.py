# encoding: utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

from copy import copy

from mo_dots import is_list
from mo_dots import listwrap, coalesce
from mo_future import is_text, text
from mo_json import json2value, value2json
from mo_logs import Log, constants, Except
from mo_logs.log_usingNothing import StructuredLogger

from mo_threads import Signal
from mo_threads.threads import STDOUT, STDIN

context = copy(globals())
del context["copy"]

DEBUG = False
DONE = value2json({"out": {}}).encode("utf8") + b"\n"
please_stop = Signal()


def command_loop(local):
    STDOUT.write(b'{"out":"ok"}\n')
    DEBUG and Log.note("python process running")

    while not please_stop:
        line = STDIN.readline()
        try:
            command = json2value(line.decode("utf8"))
            DEBUG and Log.note("got {{command}}", command=command)

            if "import" in command:
                dummy = {}
                if is_text(command["import"]):
                    exec("from " + command["import"] + " import *", dummy, context)
                else:
                    exec(
                        "from "
                        + command["import"]["from"]
                        + " import "
                        + ",".join(listwrap(command["import"]["vars"])),
                        dummy,
                        context,
                    )
                STDOUT.write(DONE)
            elif "set" in command:
                for k, v in command.set.items():
                    context[k] = v
                STDOUT.write(DONE)
            elif "get" in command:
                STDOUT.write(
                    value2json(
                        {
                            "out": coalesce(
                                local.get(command["get"]), context.get(command["get"])
                            )
                        }
                    ).encode("utf8")
                )
                STDOUT.write(b"\n")
            elif "stop" in command:
                STDOUT.write(DONE)
                please_stop.go()
            elif "exec" in command:
                if not is_text(command["exec"]):
                    Log.error("exec expects only text")
                exec(command["exec"], context, local)
                STDOUT.write(DONE)
            else:
                for k, v in command.items():
                    if is_list(v):
                        exec(
                            "_return = " + k + "(" + ",".join(map(value2json, v)) + ")",
                            context,
                            local,
                        )
                    else:
                        exec(
                            "_return = "
                            + k
                            + "("
                            + ",".join(
                                kk + "=" + value2json(vv) for kk, vv in v.items()
                            )
                            + ")",
                            context,
                            local,
                        )
                    STDOUT.write(value2json({"out": local["_return"]}).encode("utf8"))
                    STDOUT.write(b"\n")
        except Exception as e:
            e = Except.wrap(e)
            STDOUT.write(value2json({"err": e}).encode("utf8"))
            STDOUT.write(b"\n")
        finally:
            STDOUT.flush()


num_temps = 0


def temp_var():
    global num_temps
    try:
        return "temp_var" + text(num_temps)
    finally:
        num_temps += 1


class RawLogger(StructuredLogger):
    def write(self, template, params):
        STDOUT.write(value2json({"log": {"template": template, "params": params}}))


def start():
    try:
        line = STDIN.readline().decode("utf8")
        config = json2value(line)
        constants.set(config.constants)
        Log.start(config.debug)
        Log.set_logger(RawLogger())
        command_loop({"config": config})
    except Exception as e:
        Log.error("problem staring worker", cause=e)
    finally:
        Log.stop()


if __name__ == "__main__":
    start()
