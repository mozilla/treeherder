# encoding: utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import division
from __future__ import unicode_literals

import mo_math
from mo_dots import Data, coalesce
from mo_future import text
from mo_kwargs import override
from mo_logs import Log
from mo_threads import Thread, Till, Process
from mo_times import Duration, Date

MAX_RUNTIME = "hour"
WAIT_FOR_SHUTDOWN = "5minute"
NO_JOB_WAITING_TIME = 60  # SECONDS TO WAIT IF THIS LIBRARY IS NOT USED
JOBS_WAITING_TIME = 30
schedules = []


class Schedule(object):
    @override
    def __init__(
        self,
        interval,  # TIME INTERVAL BETWEEN RUNS
        starting,  # THE TIME TO START THE INTERVAL COUNT
        max_runtime=MAX_RUNTIME,  # LIMIT HOW LONG THE PROCESS IS ALIVE
        wait_for_shutdown=WAIT_FOR_SHUTDOWN,  # LIMIT PAITENCE WHEN ASKING FOR SHUTDOWN, THEN SEND KILL
        process=None,  # PARAMETERS TO START PROCESS
    ):
        self.duration = Duration(interval)
        self.starting = coalesce(Date(starting), Date.now())
        self.max_runtime = Duration(max_runtime)
        self.wait_for_shutdown = Duration(wait_for_shutdown)
        # Process parameters
        self.process = process

        # STATE
        self.last_started = None
        self.last_finished = None
        self.run_count = 0
        self.fail_count = 0
        self.current = None
        self.terminator = None  # SIGNAL TO KILL THE PROCESS
        self.next_run = self._next_run()
        self.next = Till(till=self.next_run)
        self.next_run.then(self.run)

    def _next_run_time(self):
        """
        :return: return signal for next
        """

        interval = mo_math.floor((Date.now() - self.starting) / self.duration)
        next_time = self.starting + (interval * self.duration)
        return next_time

    def run(self):
        self.last_started = Date.now()
        self.run_count += 1
        self.current = Process(**self.process)
        self.terminator = Till(seconds=self.max_runtime.seconds)
        self.terminator.then(self.killer)
        self.current.service_stopped.then(self.done)

    def killer(self, please_stop):
        self.current.stop()
        (
            please_stop
            | self.current.service_stopped()
            | Till(seconds=self.wait_for_shutdown.seconds)
        ).wait()
        if not self.current.service_stopped:
            self.fail_count += 1
            self.current.kill()
            self.current.join()

    def done(self):
        self.last_finished = Date.now()
        self.terminator.remove_go(self.killer)
        self.terminator = None
        self.current = None
        self.next_run = self._next_run_time()
        self.next = Till(till=self.next_run.unix)
        self.next.then(self.run)

    def status(self):
        if self.current is None:
            status = "never started"
        elif not self.current.service_stopped:
            status = "running"
        elif self.current.returncode == 0:
            status = "done"
        else:
            status = "failed " + text(self.current.returncode)

        return Data(
            name=self.name,
            next_run=self.next_run,
            last_started=self.last_started,
            last_finished=self.last_finished,
            status=status,
        )


def monitor(please_stop=True):
    while not please_stop:
        if not schedules:
            (Till(seconds=NO_JOB_WAITING_TIME) | please_stop).wait()
            continue
        Log.note(
            "Currently scheduled jobs:\n {{jobs|json|indent}}",
            jobs=[s.status() for s in schedules],
        )
        (Till(seconds=JOBS_WAITING_TIME) | please_stop).wait()


Log.alert("Job scheduler started...")
Thread.run("Monitor scheduled tasks", monitor)
