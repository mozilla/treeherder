#!/usr/bin/env python
"""
(Re)-generate the vendor library in ``vendor/`` from the requirements listed
in ``requirements/pure.txt``.

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
    reqs = os.path.join(base, "requirements", "pure.txt")

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
