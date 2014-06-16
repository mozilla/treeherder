#!/usr/bin/env python
import sys
import argparse
from os.path import dirname
import gevent
from gevent import monkey
monkey.patch_all()
from socketio.server import SocketIOServer
from socketio import socketio_manage
from kombu import Connection

sys.path.append(dirname(dirname(dirname(__file__))))

from treeherder.events.consumer import EventsConsumer
from treeherder.events.sockets import EventsNamespace


class Application(object):
    """wsgi application with socketio enabled"""

    def __init__(self):
        self.buffer = []

    def __call__(self, environ, start_response):
        path = environ['PATH_INFO'].strip('/') or 'index.html'

        if path.startswith("socket.io"):
            socketio_manage(environ, {'/events': EventsNamespace})
        else:
            return not_found(start_response)


def not_found(start_response):
    start_response('404 Not Found', [])
    return ['<h1>Not Found</h1>']


def broadcast_subscribers(body, msg):
    """
    This is the main function where all the magic happens
    It broadcasts the events to the clients subscribed to
    them.
    """
    pkt = dict(type="event", name=body['event'],
               args=body, endpoint='/events')

    for session_id, socket in server.sockets.iteritems():
        # loop over all the open connections
        # and send a message when needed
        if "subscriptions" not in socket.session:
            continue

        for branch, events in socket.session['subscriptions'].items():
            if branch == body["branch"] or branch == "*":
                if body["event"] in events or "*" in events:
                    socket.send_packet(pkt)
                    break
    msg.ack()


def start_consumer(broker_url):
    with Connection(broker_url) as conn:
        consumer = EventsConsumer(conn)
        consumer.listen_to("events.#", broadcast_subscribers)
        consumer.run()


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--host",
                        help="interface to bind the server to",
                        default="0.0.0.0")
    parser.add_argument("--port",
                        help="port to bind the server to",
                        default="8005",
                        type=int)
    parser.add_argument("--broker-url",
                        help="url of the broker to use",
                        required=True)
    parser.add_argument("--log-file",
                        help="where to log the access log",
                        default=None)
    args = parser.parse_args()

    try:
        server = SocketIOServer((args.host, args.port), Application(),
                                resource="socket.io", log_file=args.log_file,
                                policy_server=False, )
        print "Listening on http://{0}:{1}".format(args.host, args.port)
        print "writing logs on %s" % args.log_file
        gevent.spawn(start_consumer, args.broker_url)
        server.serve_forever()
    except KeyboardInterrupt:
        print "Socketio server stopped"
