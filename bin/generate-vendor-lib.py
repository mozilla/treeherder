#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

"""
(Re)-generate the vendor library in ``vendor/`` from the requirements listed
in ``requirements/checked-in.txt``.

This script will destroy everything in ``vendor/`` and replace it! You've been
warned.

Requires virtualenv. (We have to make an empty virtualenv and run in that,
because pip's --ignore-installed flag is buggy).

"""
import os
import shutil
import subprocess
import tempfile

from virtualenv import create_environment


def generate_vendor_lib():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target = os.path.join(base, "vendor")
    reqs = os.path.join(base, "requirements", "checked-in.txt")

    venv = tempfile.mkdtemp("-generate-vendor-lib")

    try:
        shutil.rmtree(target)
        os.mkdir(target)
        create_environment(venv, site_packages=False)
        pip = os.path.join(venv, "bin", "pip")

        subprocess.check_call(
            "{0} install --no-deps -r {1} "
            '--install-option="--install-purelib={2}" '
            '--install-option="--install-data={2}"'.format(
                pip, reqs, target),
            shell=True,
        )
    finally:
        shutil.rmtree(venv)


if __name__ == "__main__":
    generate_vendor_lib()
