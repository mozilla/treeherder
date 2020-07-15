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

from mo_logs import Except, Log, suppress_exception
from mo_logs.log_usingNothing import StructuredLogger
from mo_threads import Queue, THREAD_STOP, Thread, Till

DEBUG = False
PERIOD = 0.3


class StructuredLogger_usingThread(StructuredLogger):
    def __init__(self, logger, period=PERIOD):
        if not isinstance(logger, StructuredLogger):
            Log.error("Expecting a StructuredLogger")

        self.logger = logger
        self.queue = Queue(
            "Queue for " + self.__class__.__name__,
            max=10000,
            silent=True,
            allow_add_after_close=True,
        )
        self.thread = Thread(
            "Thread for " + self.__class__.__name__,
            worker,
            logger,
            self.queue,
            period
        )
        # worker WILL BE RESPONSIBLE FOR THREAD stop()
        self.thread.parent.remove_child(self.thread)
        self.thread.start()

    def write(self, template, params):
        try:
            self.queue.add({"template": template, "params": params})
            return self
        except Exception as e:
            e = Except.wrap(e)
            raise e  # OH NO!

    def stop(self):
        try:
            self.queue.add(THREAD_STOP)  # BE PATIENT, LET REST OF MESSAGE BE SENT
            self.thread.join()
            Log.note("joined on thread")
        except Exception as e:
            Log.note("problem in threaded logger" + str(e))

        with suppress_exception:
            self.queue.close()


def worker(logger, queue, period, please_stop):
    try:
        while True:
            log = queue.pop(till=please_stop)
            if not log:
                break
            logs = [log] + queue.pop_all()
            for log in logs:
                if log is THREAD_STOP:
                    please_stop.go()
                else:
                    logger.write(**log)
            (Till(seconds=period) | please_stop).wait()
    except Exception as e:
        import sys
        sys.stderr.write("problem in " + StructuredLogger_usingThread.__name__ + ": " + str(e))
    finally:
        Log.note("stop the child")
        logger.stop()
