Services architecture
=====================

Running treeherder at full speed requires a number of services to be started. For an overview of all the services, see the diagram below

.. image:: https://cacoo.com/diagrams/c5uZPojmQdR0QaDp-3D076.png

All the services marked with a yellow background are python scripts that can be found in the bin directory.
In a typical deployment they are monitored by something like supervisord.
Follows a description of those services.

Gunicorn
--------

A wsgi server in charge of serving the restful api and the django admin.
All the requests to this server are proxied through varnish and apache.

Gevent-socketio
---------------

A gevent-based implementation of a `socket.io`_ server that can send soft-realtime updates to the clients.
It only serves socketio-related request, typically namespaced with /socket.io.
When executing, it consumes messages from rabbitmq using a "events.#" routing key.
As soon as a new event is detected, it's sent down to the consumers who subscribed to it.
To separate the socket.io connection from the standard http ones we use varnish with the following configuration

.. literalinclude:: ../puppet/files/varnish/default.vcl
   :lines: 14-26

Celery task worker
------------------

This service executes asynchronous tasks that can be by triggered by the celerybeat task scheduler or by another worker.
In a typical treeherder deployment you will have two different pools of workers:

*  a gevent based pool, generally good for I/O bound tasks
* a pre-fork based pool, generally good for CPU bound tasks

In the bin directory of treeherder-service there's a script to run both these type of pools.

Celerybeat task scheduler
-------------------------

A scheduler process in charge of running periodic tasks.

Celerymon task monitor
----------------------

This process provides an interface to the status of the worker and the running tasks. It can be used to provide such informations
to monitoring tools like munin.



.. _socket.io: http://socket.io