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

from mo_future import allocate_lock as _allocate_lock, decorate
from mo_math.randoms import Random
from mo_threads.signals import Signal

_Log = None
_Except = None
_Thread = None
_extract_stack = None

DEBUG = False
DEBUG_SIGNAL = False


def _late_import():
    global _Log
    global _Except
    global _Thread
    global _extract_stack

    if _Thread:
        return

    from mo_logs.exceptions import Except as _Except
    from mo_logs.exceptions import get_stacktrace as _extract_stack
    from mo_threads.threads import Thread as _Thread
    from mo_logs import Log as _Log

    _ = _Log
    _ = _Except
    _ = _Thread
    _ = _extract_stack


class Lock(object):
    """
    A NON-RE-ENTRANT LOCK WITH wait()
    """
    __slots__ = ["name", "debug", "sample", "lock", "waiting"]

    def __init__(self, name="", debug=DEBUG, sample=False):
        if (debug or sample) and not _Log:
            _late_import()
        self.debug = debug
        self.sample = sample
        self.name = name
        self.lock = _allocate_lock()
        self.waiting = None

    def __enter__(self):
        if self.sample and Random.int(100) == 0:
            _Log.warning("acquire  lock {{name|quote}}", name=self.name)

        self.debug and _Log.note("acquire  lock {{name|quote}}", name=self.name)
        self.lock.acquire()
        self.debug and _Log.note("acquired lock {{name|quote}}", name=self.name)
        return self

    def __exit__(self, a, b, c):
        if self.waiting:
            self.debug and _Log.note("signaling {{num}} waiters on {{name|quote}}", name=self.name, num=len(self.waiting))
            # TELL ANOTHER THAT THE LOCK IS READY SOON
            other = self.waiting.pop()
            other.go()
        self.lock.release()
        self.debug and _Log.note("released lock {{name|quote}}", name=self.name)

    def wait(self, till=None):
        """
        THE ASSUMPTION IS wait() WILL ALWAYS RETURN WITH THE LOCK ACQUIRED
        :param till: WHEN TO GIVE UP WAITING FOR ANOTHER THREAD TO SIGNAL
        :return: True IF SIGNALED TO GO, False IF till WAS SIGNALED
        """
        waiter = Signal()
        if self.waiting:
            # TELL ANOTHER THAT THE LOCK IS READY SOON
            other = self.waiting.pop()
            other.go()
            self.debug and _Log.note("waiting with {{num}} others on {{name|quote}}", num=len(self.waiting), name=self.name, stack_depth=1)
            self.waiting.insert(0, waiter)
        else:
            self.debug and _Log.note("waiting by self on {{name|quote}}", name=self.name)
            self.waiting = [waiter]

        try:
            self.lock.release()
            self.debug and _Log.note("out of lock {{name|quote}}", name=self.name)
            (waiter | till).wait()
            self.debug and _Log.note("done minimum wait (for signal {{till|quote}})", till=till.name if till else "", name=self.name)
        except Exception as e:
            if not _Log:
                _late_import()
            _Log.warning("problem", cause=e)
        finally:
            self.lock.acquire()
            self.debug and _Log.note("re-acquired lock {{name|quote}}", name=self.name)

        try:
            self.waiting.remove(waiter)
            self.debug and _Log.note("removed own signal from {{name|quote}}", name=self.name)
        except Exception:
            pass

        return bool(waiter)


def locked(func):
    """
    WRAP func WITH A Lock, TO ENSURE JUST ONE THREAD AT A TIME
    """
    lock = Lock()
    @decorate(func)
    def output(*args, **kwargs):
        with lock:
            return func(*args, **kwargs)
    return output