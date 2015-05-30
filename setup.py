#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import os
from distutils.core import setup

# Prevents an ImportError on Read the Docs, since they don't use
# (or need) the packages in common.txt, which includes Cython.
if os.environ.get('READTHEDOCS'):
    ext_modules = []
else:
    from Cython.Build import cythonize
    ext_modules = cythonize("treeherder/log_parser/*.pyx")

setup(
    name="treeherder",
    ext_modules=ext_modules
)
