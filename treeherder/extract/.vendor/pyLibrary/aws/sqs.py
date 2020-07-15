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

from boto import sqs
from boto.sqs.message import Message

import mo_json
import mo_math
from mo_dots import unwrap, to_data
from mo_json import value2json
from mo_kwargs import override
from mo_logs import Log
from mo_threads import Signal
from mo_times.durations import SECOND


class Queue(object):
    @override
    def __init__(
        self,
        name,
        region,
        aws_access_key_id=None,
        aws_secret_access_key=None,
        debug=False,
        kwargs=None
    ):
        self.settings = kwargs
        self.pending = []  # MESSAGES READ, BUT NOT CONFIRMED

        if kwargs.region not in [r.name for r in sqs.regions()]:
            Log.error("Can not find region {{region}} in {{regions}}", region=kwargs.region, regions=[r.name for r in sqs.regions()])

        conn = sqs.connect_to_region(
            region_name=unwrap(kwargs.region),
            aws_access_key_id=unwrap(kwargs.aws_access_key_id),
            aws_secret_access_key=unwrap(kwargs.aws_secret_access_key),
        )
        self.queue = conn.get_queue(name)
        if self.queue == None:
            Log.error("Can not find queue with name {{queue}} in region {{region}}", queue=kwargs.name, region=kwargs.region)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __len__(self):
        attrib = self.queue.get_attributes("ApproximateNumberOfMessages")
        return int(attrib['ApproximateNumberOfMessages'])

    def add(self, message):
        message = to_data(message)
        m = Message()
        m.set_body(value2json(message))
        self.queue.write(m)

    @property
    def name(self):
        return self.settings.name

    def extend(self, messages):
        for m in messages:
            self.add(m)

    def pop(self, wait=SECOND, till=None):
        if till is not None and not isinstance(till, Signal):
            Log.error("Expecting a signal")

        m = self.queue.read(wait_time_seconds=mo_math.floor(wait.seconds))
        if not m:
            return None

        self.pending.append(m)
        output = mo_json.json2value(m.get_body())
        return output

    def pop_message(self, wait=SECOND, till=None):
        """
        RETURN TUPLE (message, payload) CALLER IS RESPONSIBLE FOR CALLING message.delete() WHEN DONE
        """
        if till is not None and not isinstance(till, Signal):
            Log.error("Expecting a signal")

        message = self.queue.read(wait_time_seconds=mo_math.floor(wait.seconds))
        if not message:
            return None
        message.delete = lambda: self.queue.delete_message(message)

        payload = mo_json.json2value(message.get_body())
        return message, payload

    def commit(self):
        pending, self.pending = self.pending, []
        for p in pending:
            self.queue.delete_message(p)

    def rollback(self):
        if self.pending:
            pending, self.pending = self.pending, []

            try:
                for p in pending:
                    m = Message()
                    m.set_body(p.get_body())
                    self.queue.write(m)

                for p in pending:
                    self.queue.delete_message(p)

                if self.settings.debug:
                    Log.alert("{{num}} messages returned to queue", num=len(pending))
            except Exception as e:
                Log.warning("Failed to return {{num}} messages to the queue", num=len(pending), cause=e)

    def close(self):
        self.commit()

