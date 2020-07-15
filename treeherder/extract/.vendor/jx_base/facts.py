# encoding: utf-8
#
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http:# mozilla.org/MPL/2.0/.
#
# Contact: Kyle Lahnakoski (kyle@lahnakoski.com)
#
from __future__ import absolute_import, division, unicode_literals

from mo_future import is_text
from mo_logs import Log


class Facts(object):
    """
    REPRESENT A HIERARCHICAL DATASTORE: MULTIPLE TABLES IN A DATABASE ALONG
    WITH THE RELATIONS THAT CONNECT THEM ALL, BUT LIMITED TO A TREE
    """

    def __init__(self, name, container):
        if not is_text(name):
            Log.error("parameter is wrong")
        self.container = container
        self.name = name

    @property
    def namespace(self):
        return self.container.namespace

    @property
    def snowflake(self):
        return self.schema.snowflake

    @property
    def schema(self):
        return self.container.ns.get_schema(self.name)

