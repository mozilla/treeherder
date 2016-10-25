Loading Pulse data
==================

For ingestion from Pulse exchanges, on your local machine, you can choose
to ingest from any exchange you like.  Some exchanges will be registered in
``settings.py`` for use by the Treeherder servers.  You can use those to get the
same data as Treeherder.  Or you can specify your own and experiment with
posting your own data.

Configuration
-------------

To specify the exchanges to read from, you can set environment variables in
Vagrant, or in your ``config/settings_local.py`` file.  For example::

    PULSE_DATA_INGESTION_SOURCES = [
        {
            "exchange": "exchange/taskcluster-treeherder/v1/jobs",
            "destinations": [
                'tc-treeherder'
            ],
            "projects": [
                'mozilla-inbound.#'
            ]
        }
    ]

To be able to ingest from exchanges, you need to create a Pulse user with
`Pulse Guardian`_, so
Treeherder can create your Queues for listening to the Pulse exchanges.  For
this, you must specify the connection URL in the ``PULSE_DATA_INGESTION_CONFIG``
environment variable. e.g.::

    export PULSE_DATA_INGESTION_CONFIG="amqp://mypulseuserid:mypassword@pulse.mozilla.org:5671/?ssl=1"

Ingesting Data
--------------

First, you need to begin the *Celery* queue processing.
Then to get those jobs loaded into Treeherder, start the periodic tasks with
*Celery*.  At the minimum, you will need::

    celery -A treeherder worker -B -Q pushlog,store_pulse_jobs --concurrency 5

.. note::  It is important to run the ``pushlog`` queue processing as well as ``store_pulse_jobs`` because jobs that come in from pulse for which Treeherder does not already have a resultset will be skipped.

If you want to just run all the Treeherder *Celery* tasks to enable things like
log parsing, etc, then don't specify the ``-Q`` param and it will default to
all::

    celery -A treeherder worker -B --concurrency 5

To begin listening to the Pulse exchanges specified above, run this management
command::

    ./manage.py read_pulse_jobs

Once that is running, you will see jobs start to appear from the Pulse
exchanges.


Posting Data
------------

To post data to your own pulse exchange, you can use the ``publish_to_pulse``
management command.  This command takes the ``routing_key``, ``connection_url``
and ``payload_file``.  The payload file must be a ``JSON`` representation of
a job as specified in the `YML Schema`_.

Here is a set of example parameters that could be used to run it::

    ./manage.py publish_to_pulse mozilla-inbound.staging amqp://treeherder-test:mypassword@pulse.mozilla.org:5672/ ./scratch/test_job.json

You can use the handy `Pulse Inspector`_ to view messages in your exchange to
test that they are arriving at Pulse the way you expect.

.. _Pulse Guardian: https://pulse.mozilla.org/whats_pulse
.. _Pulse Inspector: https://tools.taskcluster.net/pulse-inspector/
.. _YML Schema: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
