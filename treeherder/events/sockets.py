import logging
from collections import defaultdict
from socketio.namespace import BaseNamespace


class EventsNamespace(BaseNamespace):

    def __init__(self, *args, **kwargs):
        super(EventsNamespace, self).__init__(*args, **kwargs)
        self.logger = logging.getLogger("treeherder.events.socketio")
        self.log("New connection")
        self.session['subscriptions'] = defaultdict(set)

    def log(self, message):
        self.logger.info("[{0}] {1}".format(self.socket.sessid, message))

    def on_subscribe(self, subscription):
        """
        this method is triggered by a new client subscription.
        subscription is a string indicating a branch or branch.event
        """
        tokens = subscription.split(".")

        if len(tokens) == 1:
            # event is implicitly set to 'all'
            self.session['subscriptions'][tokens[0]].add("*")
        elif len(tokens) == 2:
            # event subscription
            self.session['subscriptions'][tokens[0]].add(tokens[1])
        else:
            self.emit('error', 'malformed subscription')

    def on_unsubscribe(self, subscription=None):
        """
        this method is triggered by a new client subscription.
        subscription is a string indicating a branch or branch.event
        if no subscription is passed, all the subscriptions are cleared
        """

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
