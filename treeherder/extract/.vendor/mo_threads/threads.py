# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
# THIS THREADING MODULE IS PERMEATED BY THE please_stop SIGNAL.
# THIS SIGNAL IS IMPORTANT FOR PROPER SIGNALLING WHICH ALLOWS
# FOR FAST AND PREDICTABLE SHUTDOWN AND CLEANUP OF THREADS

from __future__ import absolute_import, division, unicode_literals

import signal as _signal
import sys
from copy import copy
from datetime import datetime, timedelta
from time import sleep

from mo_dots import Data, coalesce, unwraplist
from mo_future import (
    allocate_lock,
    get_function_name,
    get_ident,
    start_new_thread,
    text,
    decorate,
    PY3,
)
from mo_logs import Except, Log
from mo_threads.profiles import CProfiler, write_profiles
from mo_threads.signals import AndSignals, Signal
from mo_threads.till import Till

DEBUG = False

PLEASE_STOP = str("please_stop")  # REQUIRED thread PARAMETER TO SIGNAL STOP
PARENT_THREAD = str(
    "parent_thread"
)  # OPTIONAL PARAMETER TO ASSIGN THREAD TO SOMETHING OTHER THAN CURRENT THREAD
MAX_DATETIME = datetime(2286, 11, 20, 17, 46, 39)
DEFAULT_WAIT_TIME = timedelta(minutes=10)
THREAD_STOP = "stop"
THREAD_TIMEOUT = "TIMEOUT"

datetime.strptime("2012-01-01", "%Y-%m-%d")  # http://bugs.python.org/issue7980

if PY3:
    STDOUT = sys.stdout.buffer
    STDIN = sys.stdin.buffer
else:
    STDOUT = sys.stdout
    STDIN = sys.stdin


class AllThread(object):
    """
    RUN ALL ADDED FUNCTIONS IN PARALLEL, BE SURE TO HAVE JOINED BEFORE EXIT
    """

    def __init__(self):
        self.threads = []

    def __enter__(self):
        return self

    # WAIT FOR ALL QUEUED WORK TO BE DONE BEFORE RETURNING
    def __exit__(self, type, value, traceback):
        self.join()

    def join(self):
        exceptions = []
        for t in self.threads:
            try:
                t.join()
            except Exception as e:
                exceptions.append(e)

        if exceptions:
            Log.error("Problem in child threads", cause=exceptions)

    def add(self, name, target, *args, **kwargs):
        """
        target IS THE FUNCTION TO EXECUTE IN THE THREAD
        """
        t = Thread.run(name, target, *args, **kwargs)
        self.threads.append(t)

    run = add


class BaseThread(object):
    __slots__ = ["id", "name", "children", "child_locker", "cprofiler", "trace_func"]

    def __init__(self, ident, name=None):
        self.id = ident
        self.name = name
        if ident != -1:
            self.name = "Unknown Thread " + text(ident)
        self.child_locker = allocate_lock()
        self.children = []
        self.cprofiler = None
        self.trace_func = sys.gettrace()

    def add_child(self, child):
        with self.child_locker:
            self.children.append(child)

    def remove_child(self, child):
        try:
            with self.child_locker:
                self.children.remove(child)
        except Exception:
            pass


class MainThread(BaseThread):
    def __init__(self):
        BaseThread.__init__(self, get_ident())
        self.name = "Main Thread"
        self.please_stop = Signal()
        self.stopped = Signal()
        self.stop_logging = Log.stop
        self.timers = None
        self.shutdown_locker = allocate_lock()

    def stop(self):
        """
        BLOCKS UNTIL ALL KNOWN THREADS, EXCEPT MainThread, HAVE STOPPED
        """
        global DEBUG

        self_thread = Thread.current()
        if self_thread != MAIN_THREAD or self_thread != self:
            Log.error("Only the main thread can call stop() on main thread")

        DEBUG = True
        self.please_stop.go()

        join_errors = []
        with self.child_locker:
            children = copy(self.children)
        for c in reversed(children):
            DEBUG and c.name and Log.note("Stopping thread {{name|quote}}", name=c.name)
            try:
                c.stop()
            except Exception as e:
                join_errors.append(e)

        for c in children:
            DEBUG and c.name and Log.note(
                "Joining on thread {{name|quote}}", name=c.name
            )
            try:
                c.join()
            except Exception as e:
                join_errors.append(e)

            DEBUG and c.name and Log.note(
                "Done join on thread {{name|quote}}", name=c.name
            )

        if join_errors:
            Log.error(
                "Problem while stopping {{name|quote}}",
                name=self.name,
                cause=unwraplist(join_errors),
            )

        with self.shutdown_locker:
            if self.stopped:
                return
            self.stop_logging()
            self.timers.stop()
            self.timers.join()

            write_profiles(self.cprofiler)
            DEBUG and Log.note("Thread {{name|quote}} now stopped", name=self.name)
            self.stopped.go()

    def wait_for_shutdown_signal(
        self,
        please_stop=False,  # ASSIGN SIGNAL TO STOP EARLY
        allow_exit=False,  # ALLOW "exit" COMMAND ON CONSOLE TO ALSO STOP THE APP
        wait_forever=True,  # IGNORE CHILD THREADS, NEVER EXIT.  False => IF NO CHILD THREADS LEFT, THEN EXIT
    ):
        """
        FOR USE BY PROCESSES THAT NEVER DIE UNLESS EXTERNAL SHUTDOWN IS REQUESTED

        CALLING THREAD WILL SLEEP UNTIL keyboard interrupt, OR please_stop, OR "exit"

        :param please_stop:
        :param allow_exit:
        :param wait_forever:: Assume all needed threads have been launched. When done
        :return:
        """
        self_thread = Thread.current()
        if self_thread != MAIN_THREAD or self_thread != self:
            Log.error(
                "Only the main thread can sleep forever (waiting for KeyboardInterrupt)"
            )

        if isinstance(please_stop, Signal):
            # MUTUAL SIGNALING MAKES THESE TWO EFFECTIVELY THE SAME SIGNAL
            self.please_stop.then(please_stop.go)
            please_stop.then(self.please_stop.go)
        else:
            please_stop = self.please_stop

        if not wait_forever:
            # TRIGGER SIGNAL WHEN ALL CHILDREN THREADS ARE DONE
            with self_thread.child_locker:
                pending = copy(self_thread.children)
            children_done = AndSignals(self.please_stop, len(pending))
            children_done.signal.then(self.please_stop.go)
            for p in pending:
                p.stopped.then(children_done.done)

        try:
            if allow_exit:
                _wait_for_exit(self.please_stop)
            else:
                _wait_for_interrupt(self.please_stop)
            Log.alert("Stop requested!  Stopping...")
        except KeyboardInterrupt as _:
            Log.alert("SIGINT Detected!  Stopping...")
        except SystemExit as _:
            Log.alert("SIGTERM Detected!  Stopping...")
        finally:
            self.stop()


class Thread(BaseThread):
    """
    join() ENHANCED TO ALLOW CAPTURE OF CTRL-C, AND RETURN POSSIBLE THREAD EXCEPTIONS
    run() ENHANCED TO CAPTURE EXCEPTIONS
    """

    num_threads = 0

    def __init__(self, name, target, *args, **kwargs):
        BaseThread.__init__(self, -1, coalesce(name, "thread_" + text(object.__hash__(self))))
        self.target = target
        self.end_of_thread = Data()
        self.args = args

        # ENSURE THERE IS A SHARED please_stop SIGNAL
        self.kwargs = copy(kwargs)
        self.please_stop = self.kwargs.get(PLEASE_STOP)
        if self.please_stop is None:
            self.please_stop = self.kwargs[PLEASE_STOP] = Signal(
                "please_stop for " + self.name
            )
        self.please_stop.then(self.start)

        self.thread = None
        self.ready_to_stop = Signal("joining with " + self.name)
        self.stopped = Signal("stopped signal for " + self.name)

        if PARENT_THREAD in kwargs:
            del self.kwargs[PARENT_THREAD]
            self.parent = kwargs[PARENT_THREAD]
        else:
            self.parent = Thread.current()
            self.parent.add_child(self)

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        if isinstance(type, BaseException):
            self.please_stop.go()

        # TODO: AFTER A WHILE START KILLING THREAD
        self.join()
        self.args = None
        self.kwargs = None

    def start(self):
        try:
            if self.thread:
                return
            self.thread = start_new_thread(Thread._run, (self,))
            return self
        except Exception as e:
            Log.error("Can not start thread", e)

    def stop(self):
        """
        SEND STOP SIGNAL, DO NOT BLOCK
        """
        with self.child_locker:
            children = copy(self.children)
        for c in children:
            DEBUG and c.name and Log.note("Stopping thread {{name|quote}}", name=c.name)
            c.stop()
        self.please_stop.go()

        DEBUG and Log.note("Thread {{name|quote}} got request to stop", name=self.name)

    def _run(self):
        self.id = get_ident()
        with RegisterThread(self):
            try:
                if self.target is not None:
                    a, k, self.args, self.kwargs = self.args, self.kwargs, None, None
                    self.end_of_thread.response = self.target(*a, **k)
            except Exception as e:
                e = Except.wrap(e)
                self.end_of_thread.exception = e
                with self.parent.child_locker:
                    emit_problem = self not in self.parent.children
                if emit_problem:
                    # THREAD FAILURES ARE A PROBLEM ONLY IF NO ONE WILL BE JOINING WITH IT
                    try:
                        Log.error(
                            "Problem in thread {{name|quote}}", name=self.name, cause=e
                        )
                    except Exception:
                        sys.stderr.write(
                            str("ERROR in thread: " + self.name + " " + text(e) + "\n")
                        )
            finally:
                try:
                    with self.child_locker:
                        children = copy(self.children)
                    for c in children:
                        try:
                            DEBUG and Log.note("Stopping thread " + c.name + "\n")
                            c.stop()
                        except Exception as e:
                            Log.warning(
                                "Problem stopping thread {{thread}}",
                                thread=c.name,
                                cause=e,
                            )

                    for c in children:
                        try:
                            DEBUG and Log.note("Joining on thread " + c.name + "\n")
                            c.join()
                        except Exception as e:
                            Log.warning(
                                "Problem joining thread {{thread}}",
                                thread=c.name,
                                cause=e,
                            )
                        finally:
                            DEBUG and Log.note("Joined on thread " + c.name + "\n")

                    del self.target, self.args, self.kwargs
                    DEBUG and Log.note("thread {{name|quote}} stopping", name=self.name)
                except Exception as e:
                    DEBUG and Log.warning(
                        "problem with thread {{name|quote}}", cause=e, name=self.name
                    )
                finally:
                    if not self.ready_to_stop:
                        DEBUG and Log.note("thread {{name|quote}} is done, wait for join", name=self.name)
                        # WHERE DO WE PUT THE THREAD RESULT?
                        # IF NO THREAD JOINS WITH THIS, THEN WHAT DO WE DO WITH THE RESULT?
                        # HOW LONG DO WE WAIT FOR ANOTHER TO ACCEPT THE RESULT?
                        #
                        # WAIT 60seconds, THEN SEND RESULT TO LOGGER
                        (Till(seconds=60) | self.ready_to_stop).wait()

                    self.stopped.go()

                    if not self.ready_to_stop:
                        if self.end_of_thread.exception:
                            # THREAD FAILURES ARE A PROBLEM ONLY IF NO ONE WILL BE JOINING WITH IT
                            try:
                                Log.error(
                                    "Problem in thread {{name|quote}}", name=self.name, cause=e
                                )
                            except Exception:
                                sys.stderr.write(
                                    str("ERROR in thread: " + self.name + " " + text(e) + "\n")
                                )
                        elif self.end_of_thread.response != None:
                            Log.warning(
                                "Thread {{thread}} returned a response, but was not joined with {{parent}} after 10min",
                                thread=self.name,
                                parent=self.parent.name
                            )
                        else:
                            # IF THREAD ENDS OK, AND NOTHING RETURNED, THEN FORGET ABOUT IT
                            self.parent.remove_child(self)

    def is_alive(self):
        return not self.stopped

    def release(self):
        """
        RELEASE THREAD TO FEND FOR ITSELF. THREAD CAN EXPECT TO NEVER
        JOIN. WILL SEND RESULTS TO LOGS WHEN DONE.

        PARENT THREAD WILL STILL ENSURE self HAS STOPPED PROPERLY
        """
        self.ready_to_stop.go()
        return self

    def join(self, till=None):
        """
        RETURN THE RESULT {"response":r, "exception":e} OF THE THREAD EXECUTION (INCLUDING EXCEPTION, IF EXISTS)
        """
        if self is Thread:
            Log.error("Thread.join() is not a valid call, use t.join()")

        with self.child_locker:
            children = copy(self.children)
        for c in children:
            c.join(till=till)

        DEBUG and Log.note(
            "{{parent|quote}} waiting on thread {{child|quote}}",
            parent=Thread.current().name,
            child=self.name,
        )
        self.ready_to_stop.go()
        (self.stopped | till).wait()
        if self.stopped:
            self.parent.remove_child(self)
            if not self.end_of_thread.exception:
                return self.end_of_thread.response
            else:
                Log.error(
                    "Thread {{name|quote}} did not end well",
                    name=self.name,
                    cause=self.end_of_thread.exception,
                )
        else:
            raise Except(context=THREAD_TIMEOUT)

    @staticmethod
    def run(name, target, *args, **kwargs):
        # ENSURE target HAS please_stop ARGUMENT
        if get_function_name(target) == "wrapper":
            pass  # GIVE THE override DECORATOR A PASS
        elif PLEASE_STOP not in target.__code__.co_varnames:
            Log.error(
                "function must have please_stop argument for signalling emergency shutdown"
            )

        Thread.num_threads += 1

        output = Thread(name, target, *args, **kwargs)
        output.start()
        return output

    @staticmethod
    def current():
        ident = get_ident()
        with ALL_LOCK:
            output = ALL.get(ident)

        if output is None:
            thread = BaseThread(ident)
            thread.cprofiler = CProfiler()
            thread.cprofiler.__enter__()
            with ALL_LOCK:
                ALL[ident] = thread
            Log.warning(
                "this thread is not known. Register this thread at earliest known entry point."
            )
            return thread
        return output


class RegisterThread(object):
    """
    A context manager to handle threads spawned by other libs
    This will ensure the thread has unregistered, or
    has completed before MAIN_THREAD is shutdown
    """

    __slots__ = ["thread"]

    def __init__(self, thread=None, name=None):
        if thread is None:
            thread = BaseThread(get_ident(), name)
        self.thread = thread

    def __enter__(self):
        with ALL_LOCK:
            ALL[self.thread.id] = self.thread
        self.thread.cprofiler = CProfiler()
        self.thread.cprofiler.__enter__()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.thread.cprofiler.__exit__(exc_type, exc_val, exc_tb)
        with self.thread.child_locker:
            if self.thread.children:
                Log.error(
                    "Thread {{thread|quote}} has not joined with child threads {{children|json}}",
                    children=[c.name for c in self.thread.children],
                    thread=self.thread.name
                )
        with ALL_LOCK:
            del ALL[self.thread.id]


def register_thread(func):
    """
    Call `with RegisterThread():`
    Track this thread to ensure controlled shutdown
    """

    @decorate(func)
    def output(*args, **kwargs):
        with RegisterThread():
            return func(*args, **kwargs)

    return output


def _wait_for_exit(please_stop):
    """
    /dev/null PIPED TO sys.stdin SPEWS INFINITE LINES, DO NOT POLL AS OFTEN
    """
    cr_count = 0  # COUNT NUMBER OF BLANK LINES

    try:
        while not please_stop:
            # DEBUG and Log.note("inside wait-for-shutdown loop")
            if cr_count > 30:
                (Till(seconds=3) | please_stop).wait()
            try:
                # line = ""
                line = STDIN.readline()
            except Exception as e:
                Except.wrap(e)
                if "Bad file descriptor" in e:
                    Log.note("can not read from stdin")
                    _wait_for_interrupt(please_stop)
                    break

            # DEBUG and Log.note("read line {{line|quote}}, count={{count}}", line=line, count=cr_count)
            if not line:
                cr_count += 1
            else:
                cr_count = -1000000  # NOT /dev/null

            if line.strip() == b"exit":
                Log.alert("'exit' Detected!  Stopping...")
                return
    except Exception as e:
        Log.warning("programming error", cause=e)
    finally:
        if please_stop:
            Log.note("please_stop has been requested")
        Log.note("done waiting for exit")


def _wait_for_interrupt(please_stop):
    DEBUG and Log.note("wait for stop signal")
    try:
        # ALTERNATE BETWEEN please_stop CHECK AND SIGINT CHECK
        while not please_stop:
            sleep(1)  # LOCKS CAN NOT BE INTERRUPTED, ONLY sleep() CAN
    finally:
        please_stop.go()


MAIN_THREAD = MainThread()


def stop_main_thread(signum=0, frame=None):
    MAIN_THREAD.please_stop.go()


_signal.signal(_signal.SIGTERM, stop_main_thread)
_signal.signal(_signal.SIGINT, stop_main_thread)

ALL_LOCK = allocate_lock()
ALL = dict()
ALL[get_ident()] = MAIN_THREAD
