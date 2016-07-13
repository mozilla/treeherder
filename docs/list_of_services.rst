Services architecture
=====================

Running treeherder at full speed requires a number of services to be started. For an overview of all the services, see the diagram below

.. image:: https://cacoo.com/diagrams/c5uZPojmQdR0QaDp-3D076.png

All the services marked with a yellow background are python scripts that can be found in the bin directory.
In a typical deployment they are monitored by something like supervisord.
Follows a description of those services.

Gunicorn
--------

A wsgi server in charge of serving the restful api and the static UI assets.
All the requests to this server are proxied through Varnish.

Celery task worker
------------------

This service executes asynchronous tasks that can be by triggered by the celerybeat task scheduler or by another worker.

Celerybeat task scheduler
-------------------------

A scheduler process in charge of running periodic tasks.

Celerymon task monitor
----------------------

This process provides an interface to the status of the worker and the running tasks. It can be used to provide such information
to monitoring tools like munin.
