# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

"""
This module contains
"""
from celery import task, group
from treeherder.etl.bugzilla import BzApiBugProcess


@task(name='fetch-bugs', time_limit=10 * 60)
def fetch_bugs():
    """
    Run a BzApiBug process
    """
    process = BzApiBugProcess()
    process.run()
