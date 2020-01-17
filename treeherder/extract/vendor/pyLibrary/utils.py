# encoding: utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import division, unicode_literals

import datetime

from mo_dots import DataObject, Null, unwrap
from mo_future import text, zip_longest


class Version(object):

    __slots__ = ["version"]

    def __new__(cls, version):
        if version == None:
            return Null
        else:
            return object.__new__(cls)

    def __init__(self, version):
        version = unwrap(version)

        if isinstance(version, tuple):
            self.version = version
        elif isinstance(version, DataObject):
            self.version = [0, 0, 0]
        elif isinstance(version, Version):
            self.version = version.version
        else:
            try:
            self.version = tuple(map(int, version.split('.')))
            except Exception as e:
                self.version = [0, 0, 0]

    def __gt__(self, other):
        other = Version(other)
        for s, o in zip_longest(self.version, other.version):
            if s is None and o is not None:
                return False
            elif s is not None and o is None:
                return True
            elif s < o:
                return False
            elif s > o:
                return True

        return False

    def __ge__(self, other):
        return self == other or self > other

    def __eq__(self, other):
        other = Version(other)
        return self.version == other.version

    def __le__(self, other):
        return self == other or not (self > other)

    def __lt__(self, other):
        return not (self == other) and not (self > other)

    def __ne__(self, other):
        other = Version(other)
        return self.version != other.version

    def __str__(self):
        return text(".").join(map(text, self.version))

    def __add__(self, other):
        major, minor, mini = self.version
        minor += other
        mini = datetime.datetime.utcnow().strftime("%y%j")
        return Version((major, minor, mini))

    @property
    def major(self):
        return self.version[0]

    @property
    def minor(self):
        return self.version[1]

    @property
    def mini(self):
        return self.version[2]
