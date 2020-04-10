# Loading Pulse data

By default, running the Docker container with `docker-compose up` will ingest data
from the `autoland` repo using a shared [Pulse Guardian] user.  You can configure this the following ways:

1. Specify a custom set of repositories for which to ingest data
2. Create a custom **Pulse User** on [Pulse Guardian]

## Custom list of Repositories

Set the environment variable of `PROJECTS_TO_INGEST`:

```bash
export PROJECTS_TO_INGEST=autoland,try
```

## Pulse Guardian

Visit [Pulse Guardian], sign in, and create a **Pulse User**. It will ask you to set a
username and password. Remember these as you'll use them in the next step.
This is recommended, because using the default value **MAY** cause you to miss some data,
if it was already ingested by another user  Unfortunately, **Pulse** doesn't support creating
queues with a guest account.

If your **Pulse User** was username: `foo` and password: `bar`, your Pulse URL
would be:

`amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1`

<!-- prettier-ignore -->
!!! note
    Be sure you do **NOT** use quotes when setting the value of PULSE_URL.  Otherwise, you may get an
    error: ``KeyError: 'No such transport: '``

On your localhost set PULSE_URL as follows, subsituting the url above:

```bash
export PULSE_URL=amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1
```

See [Starting a local Treeherder instance] for more info.

[starting a local treeherder instance]: installation.md#starting-a-local-treeherder-instance

## Advanced Celery Configuration

If you only want to ingest the Pushes and Tasks, then the default will do that for you.
But if you want to do other processing like parsing logs, etc, then you can specify the other queues
you would like to process.

Open a new terminal window. To run all the queues do:

```bash
docker-compose run backend celery -A treeherder worker -B --concurrency 5
```

You will see a list of activated queues.  If you wanted to narrow that down, then note
which queues you'd like to run and add them to a comma-separated list.  For instance, to
only do Log Parsing:

```bash
celery -A treeherder worker -B -Q log_parser,log_parser_fail --concurrency 5
```

## Posting Data

To post data to your own **Pulse** exchange, you can use the `publish_to_pulse`
management command. This command takes the `routing_key`, `connection_url`
and `payload_file`. The payload file must be a `JSON` representation of
a job as specified in the [YML Schema].

Here is a set of example parameters that could be used to run it:

```bash
./manage.py publish_to_pulse mozilla-inbound.staging amqp://treeherder-test:mypassword@pulse.mozilla.org:5672/ ./scratch/test_job.json
```

You can use the handy Pulse Inspector to view messages in your exchange to
test that they are arriving at Pulse the way you expect. Each exchange has its
own inspector that can be accessed like so: `<rootUrl>/pulse-messages/`
ex: <https://community-tc.services.mozilla.com/pulse-messages/>

[pulse guardian]: https://pulseguardian.mozilla.org/whats_pulse
[yml schema]: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
