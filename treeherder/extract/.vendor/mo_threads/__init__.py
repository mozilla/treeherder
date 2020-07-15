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

from mo_threads import till
from mo_threads.futures import Future
from mo_threads.lock import Lock
from mo_threads.multiprocess import Process
from mo_threads.queues import Queue, ThreadedQueue
from mo_threads.signals import Signal, DONE
from mo_threads.threads import (
    MAIN_THREAD,
    MainThread,
    THREAD_STOP,
    THREAD_TIMEOUT,
    Thread,
    stop_main_thread,
    register_thread
)
from mo_threads.till import Till

MAIN_THREAD.timers = Thread.run("timers daemon", till.daemon)
MAIN_THREAD.children.remove(MAIN_THREAD.timers)
till.enabled.wait()
keep_import = (
    Future,
    Till,
    Lock,
    Process,
    Queue,
    ThreadedQueue,
    Signal,
    DONE,
    MainThread,
    THREAD_STOP,
    THREAD_TIMEOUT,
    stop_main_thread,
    register_thread
)
