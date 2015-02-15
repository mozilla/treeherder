# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import logging
from collections import defaultdict
from socketio.namespace import BaseNamespace

logger = logging.getLogger(__name__)


class EventsNamespace(BaseNamespace):

    def __init__(self, *args, **kwargs):
        super(EventsNamespace, self).__init__(*args, **kwargs)
        logger.info("New connection")
        self.session['subscriptions'] = defaultdict(set)

    def log(self, message, level="DEBUG"):
        logger.log(getattr(logging, level),
                   "[{0}] {1}".format(self.socket.sessid, message))

    def on_subscribe(self, subscription):
        """
        this method is triggered by a new client subscription.
        subscription is a string indicating a branch or branch.event
        """

        tokens = subscription.split(".")
        self.log("subscribing to {0}".format(subscription))
        if len(tokens) == 1:
            # event is implicitly set to 'all'
            self.session['subscriptions'][tokens[0]].add("*")
        elif len(tokens) == 2:
            # event subscription
            self.session['subscriptions'][tokens[0]].add(tokens[1])
        else:
            error_message = 'malformed subscription'
            self.emit('error', error_message)
            self.log(error_message, "ERROR")

    def on_unsubscribe(self, subscription=None):
        """
        this method is triggered by a new client subscription.
        subscription is a string indicating a branch or branch.event
        if no subscription is passed, all the subscriptions are cleared
        """

        self.log("unsubscribing from channels: {0}".format(subscription))
        if not subscription:
            self.session['subscriptions'] = defaultdict(set)
        else:
            tokens = subscription.split(".")
            if len(tokens) == 1:
                del self.session['subscriptions'][tokens[0]]
            else:
                self.session['subscriptions'][tokens[0]].remove(tokens[1])

    def recv_disconnect(self):
        self.log("Disconnected")
        return True
