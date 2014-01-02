import logging

from socketio.namespace import BaseNamespace


class EventsNamespace(BaseNamespace):

    def __init__(self, *args, **kwargs):
        super(EventsNamespace, self).__init__(*args, **kwargs)
        self.logger = logging.getLogger("treeherder.events.socketio")
        self.log("New connection")
        self.session['branch'] = set()
        self.session['event'] = set()

    def log(self, message):
        self.logger.info("[{0}] {1}".format(self.socket.sessid, message))

    def on_subscribe(self, subscription):
        """
        this method is triggered by a new client subscription.
        it adds a prefix to the routing key to prevent message sniffing
        """
        tokens = subscription.split(".")

        if len(tokens) == 1:
            # branch subscription
            self.session['branch'].add(tokens[0])
            # event is implicitly set to 'all'
            self.session['event'].add("*")
        elif len(tokens) == 2:
            # event subscription
            self.session['branch'].add(tokens[0])
            self.session['event'].add(tokens[1])
        else:
            self.emit('error', 'malformed subscription')

    def on_unsubscribe(self):
        self.session['branch'] = set()
        self.session['event'] = set()
        self.log("subscription reset")

    def recv_disconnect(self):
        self.log("Disconnected")
        return True
