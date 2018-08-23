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

  1. Create a user on [Pulse Guardian] if you don't already have one
  2. Create your ``PULSE_URL`` string
  3. Open a Vagrant terminal to read Pushes
  4. Open a Vagrant terminal to read Jobs
  5. Open a Vagrant terminal to run **Celery**


### 1. Pulse Guardian

Visit [Pulse Guardian], sign in, and create a **Pulse User**.  It will ask you to set a
username and password.  Remember these as you'll use them in the next step.
Unfortunately, **Pulse** doesn't support creating queues with a guest account, so
this step is necessary.


### 2. Environment Variable

If your **Pulse User** was username: ``foo`` and password: ``bar``, your config
string would be:

```bash
PULSE_URL="amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1"
```


### 3. Read Pushes

```eval_rst
.. note:: Be sure your Vagrant environment is up-to-date.  Reload it and run ``vagrant provision`` if you're not sure.
```

``ssh`` into Vagrant, then set your config environment variable:

```bash
export PULSE_URL="amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1"
```

Next, run the Treeherder management command to read Pushes from the default **Pulse**
exchange:

```bash
./manage.py read_pulse_pushes
```

You will see a list of the exchanges it has mounted to and a message for each
push as it is read.  This process does not ingest the push into Treeherder.  It
adds that Push message to a local **Celery** queue for ingestion.  They will be
ingested in step 5.


### 4. Read Jobs

As in step 3, open a Vagrant terminal and export your ``PULSE_URL``
variable.  Then run the following management command:

```bash
./manage.py read_pulse_jobs
```

You will again see the list of exchanges that your queue is now mounted to and
a message for each Job as it is read into your local **Celery** queue.


### 5. Celery

Open your next Vagrant terminal.  You don't need to set your environment variable
in this one.  Just run **Celery**:

```bash
celery -A treeherder worker -B --concurrency 5
```

That's it!  With those processes running, you will begin ingesting Treeherder
data.  To see the data, you will need to run the Treeherder UI and API.
See [Running the unminified UI with Vagrant] for more info.

[Running the unminified UI with Vagrant]: ui/installation.html#running-the-unminified-ui-with-vagrant


Advanced Configuration
----------------------

### Changing which Data to Ingest

``treeherder.services.pulse.sources`` provides default sources for both Jobs and Pushes.
However you can override these defaults using the standard env methods show below.

#### Pushes
``PULSE_PUSH_SOURCES`` defines a list of dictionaries with exchange and routing key strings.
```bash
export PULSE_PUSH_SOURCES='[{"exchange": "exchange/taskcluster-github/v1/push","routing_keys": ["bugzilla#"]}]'
```

#### Jobs
``PULSE_JOB_EXCHANGES`` defines a list of exchanges to listen to.
```bash
export PULSE_JOB_EXCHANGES="exchange/taskcluster-treeherder/v1/jobs,exchange/fxtesteng/jobs"
```

To change which exchanges you listen to for pushes, you would modify
``PULSE_PUSH_SOURCES``.  For instance, to get only Gitbub pushes for Bugzilla,
you would set:

``PULSE_JOB_PROJECTS`` defines a list of projects to listen to.
```bash
export PULSE_JOB_PROJECTS="try,mozilla-central"
```

The source settings are combined such that all `projects` are applied to **each** `exchange`.
The example settings above would produce the following settings:

```python
[{
    "exchange": "exchange/taskcluster-treeherder/v1/jobs",
    "projects": [
        "try",
        "mozilla-central",
    ],
}, {
    "exchange": "exchange/fxtesteng/jobs",
    "projects": [
        "try",
        "mozilla-central",
    ],
}]
```


### Advanced Celery options

If you only want to ingest the Pushes and Jobs, but don't care about log parsing
and all the other processing Treeherder does, then you can minimize the **Celery**
task.  You will need:

```bash
celery -A treeherder worker -B -Q pushlog,store_pulse_jobs,store_pulse_resultsets --concurrency 5
```

* The ``pushlog`` queue loads up to the last 10 Mercurial pushes that exist.
* The ``store_pulse_resultsets`` queue will ingest all the pushes from the exchanges
  specified in ``PULSE_PUSH_SOURCES``.  This can be Mercurial and Github
* The ``store_pulse_jobs`` queue will ingest all the jobs from the exchanges
  specified in ``PULSE_JOB_EXCHANGES``.

```eval_rst
.. note:: Any job that comes from **Pulse** that does not have an associated push will be skipped.
.. note:: It is slightly confusing to see ``store_pulse_resultsets`` there.  It is there for legacy reasons and will change to ``store_pulse_pushes`` at some point.
```


Posting Data
------------

To post data to your own **Pulse** exchange, you can use the ``publish_to_pulse``
management command.  This command takes the ``routing_key``, ``connection_url``
and ``payload_file``.  The payload file must be a ``JSON`` representation of
a job as specified in the [YML Schema].

Here is a set of example parameters that could be used to run it:

```bash
./manage.py publish_to_pulse mozilla-inbound.staging amqp://treeherder-test:mypassword@pulse.mozilla.org:5672/ ./scratch/test_job.json
```

You can use the handy [Pulse Inspector] to view messages in your exchange to
test that they are arriving at Pulse the way you expect.

[Pulse Guardian]: https://pulseguardian.mozilla.org/whats_pulse
[Pulse Inspector]: https://tools.taskcluster.net/pulse-inspector/
[YML Schema]: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
