Loading Pulse data
==================

For ingestion from **Pulse** exchanges, on your local machine, you can choose
to ingest from any exchange you like.  Some exchanges will be registered in
``settings.py`` for use by the Treeherder servers.  You can use those to get the
same data as Treeherder.  Or you can specify your own and experiment with
posting your own data.

The Simple Case
---------------

If you just want to get the same data that Treeherder gets, then you have 3 steps:

  1. Create a user on `Pulse Guardian`_ if you don't already have one
  2. Create your ``PULSE_DATA_INGESTION_CONFIG`` string
  3. Open a Vagrant terminal to read Pushes
  4. Open a Vagrant terminal to read Jobs
  5. Open a Vagrant terminal to run **Celery**


1. Pulse Guardian
~~~~~~~~~~~~~~~~~

Visit `Pulse Guardian`_, sign in, and create a **Pulse User**.  It will ask you to set a
username and password.  Remember these as you'll use them in the next step.
Unfortunately, **Pulse** doesn't support creating queues with a guest account, so
this step is necessary.

2. Environment Variable
~~~~~~~~~~~~~~~~~~~~~~~

If your **Pulse User** was username: ``foo`` and password: ``bar``, your config
string would be::

    PULSE_DATA_INGESTION_CONFIG="amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1"

3. Read Pushes
~~~~~~~~~~~~~~

.. note:: Be sure your Vagrant environment is up-to-date.  Reload it and run ``vagrant provision`` if you're not sure.

``ssh`` into Vagrant, then set your config environment variable::

    export PULSE_DATA_INGESTION_CONFIG="amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1"

Next, run the Treeherder management command to read Pushes from the default **Pulse**
exchange::

    ./manage.py read_pulse_pushes

You will see a list of the exchanges it has mounted to and a message for each
push as it is read.  This process does not ingest the push into Treeherder.  It
adds that Push message to a local **Celery** queue for ingestion.  They will be
ingested in step 5.

4. Read Jobs
~~~~~~~~~~~~

As in step 3, open a Vagrant terminal and export your ``PULSE_DATA_INGESTION_CONFIG``
variable.  Then run the following management command::

    ./manage.py read_pulse_jobs

You will again see the list of exchanges that your queue is now mounted to and
a message for each Job as it is read into your local **Celery** queue.

5. Celery
~~~~~~~~~

Open your next Vagrant terminal.  You don't need to set your environment variable
in this one.  Just run **Celery**::

    celery -A treeherder worker -B --concurrency 5

That's it!  With those processes running, you will begin ingesting Treeherder
data.  To see the data, you will need to run the Treeherder UI.
See :ref:`unminified_ui` for more info.

Advanced Configuration
----------------------

Changing which data to ingest
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you don't want all the sources provided by default in ``settings.py``, you
can specify the exchange(s) to listen to for jobs by modifying
``PULSE_DATA_INGESTION_SOURCES``.  For instance, you could specify the projects
as only ``try`` and ``mozilla-central`` by setting::

    export PULSE_DATA_INGESTION_SOURCES='[{"exchange": "exchange/taskcluster-treeherder/v1/jobs", "destinations": ["#"], "projects": ["try", "mozilla-central"]}]'

To change which exchanges you listen to for pushes, you would modify
``PULSE_PUSH_SOURCES``.  For instance, to get only **Gitbub** pushes for Bugzilla,
you would set::

    export PULSE_PUSH_SOURCES='[{"exchange": "exchange/taskcluster-github/v1/push","routing_keys": ["bugzilla#"]}]'

Advanced Celery options
~~~~~~~~~~~~~~~~~~~~~~~

If you only want to ingest the Pushes and Jobs, but don't care about log parsing
and all the other processing Treeherder does, then you can minimize the **Celery**
task.  You will need::

    celery -A treeherder worker -B -Q pushlog,store_pulse_jobs,store_pulse_resultsets --concurrency 5

* The ``pushlog`` queue loads up to the last 10 Mercurial pushes that exist.
* The ``store_pulse_resultsets`` queue will ingest all the pushes from the exchanges
  specified in ``PULSE_PUSH_SOURCES``.  This can be Mercurial and Github
* The ``store_pulse_jobs`` queue will ingest all the jobs from the exchanges
  specified in ``PULSE_DATA_INGESTION_SOURCES``.

.. note:: Any job that comes from **Pulse** that does not have an associated push will be skipped.
.. note:: It is slightly confusing to see ``store_pulse_resultsets`` there.  It is there for legacy reasons and will change to ``store_pulse_pushes`` at some point.


Posting Data
------------

To post data to your own **Pulse** exchange, you can use the ``publish_to_pulse``
management command.  This command takes the ``routing_key``, ``connection_url``
and ``payload_file``.  The payload file must be a ``JSON`` representation of
a job as specified in the `YML Schema`_.

Here is a set of example parameters that could be used to run it::

    ./manage.py publish_to_pulse mozilla-inbound.staging amqp://treeherder-test:mypassword@pulse.mozilla.org:5672/ ./scratch/test_job.json

You can use the handy `Pulse Inspector`_ to view messages in your exchange to
test that they are arriving at Pulse the way you expect.

.. _Pulse Guardian: https://pulseguardian.mozilla.org/whats_pulse
.. _Pulse Inspector: https://tools.taskcluster.net/pulse-inspector/
.. _YML Schema: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
