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

from mo_logs.exceptions import suppress_exception
from mo_threads import Process, THREAD_STOP
from pyLibrary.meta import cache


@cache
def get_revision():
    """
    GET THE CURRENT GIT REVISION
    """
    proc = Process("git log", ["git", "log", "-1"])

    try:
        for line in proc.stdout:
            if line.startswith("commit "):
                return line[7:]
    finally:
        with suppress_exception:
            proc.join()


@cache
def get_remote_revision(url, branch):
    """
    GET REVISION OF A REMOTE BRANCH
    """
    proc = Process("git remote revision", ["git", "ls-remote", url, "refs/heads/" + branch])

    try:
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            return line.split("\t")[0]
    finally:
        try:
            proc.join()
        except Exception:
            pass


@cache
def get_branch():
    """
    GET THE CURRENT GIT BRANCH
    """
    proc = Process("git status", ["git", "status"])

    try:
        for line in proc.stdout:
            if line.startswith("On branch "):
                return line[10:]
    finally:
        try:
            proc.join()
        except Exception:
            pass
