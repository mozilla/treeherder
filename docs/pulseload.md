# Pulse Ingestion Configuration

By default, running the Docker container with `docker-compose up` will ingest data
from the `autoland` and `try` repositories using a shared [Pulse Guardian] user. You can configure this the following ways:

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
if it was already ingested by another user. Unfortunately **Pulse** doesn't support creating
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

## Posting Data

To post data to your own **Pulse** exchange, you can use the `publish_to_pulse`
management command. This command takes the `routing_key`, `connection_url`
and `payload_file`. The payload file must be a `JSON` representation of
a job as specified in the [YML Schema].

Here is a set of example parameters that could be used to run it:

```bash
./manage.py publish_to_pulse autoland.staging amqp://treeherder-test:mypassword@pulse.mozilla.org:5672/ ./scratch/test_job.json
```

You can use the handy Pulse Inspector to view messages in your exchange to
test that they are arriving at Pulse the way you expect. Each exchange has its
own inspector that can be accessed like so: `<rootUrl>/pulse-messages/`
ex: <https://community-tc.services.mozilla.com/pulse-messages/>

[pulse guardian]: https://pulseguardian.mozilla.org/whats_pulse
[yml schema]: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml

## Setup for Perfherder Development

These steps should help you set up everything you need to ingest data locally while working on perfherder.

**Create a pulse guardian account and run:**

```bash
export PULSE_URL=amqp://USER:PASSWORD@pulse.mozilla.org:5671/?ssl=1
yarn install
```

**Run each of these commands in a seperate window:**

```bash
docker-compose up --build
docker-compose run -e PROJECTS_TO_INGEST=autoland backend celery -A treeherder worker --concurrency 1
```

---

**Run the db viewer**

You can use any database viewer of your choice `(e.g. dbeaver-ce, mysql workbench, etc.)`

**Connect to the following while `docker-compose up --build` from the previous step is running:**

`Serverhost: localhost`
`Port: 3306`
`Database: treeherder`
`Username: root`
`No password`

---

##### Run the following in separate window while running above to do ingestion

<!-- prettier-ignore -->
!!! note
    These commands perform fetches for the data, they are run sequentially in the same window. The first command makes the second one run faster.

**Ingest push:**

```bash
docker-compose exec backend ./manage.py ingest push -p autoland -r 1ee42a54a431acdd6cbe43b49de0237fe67eddd9
```

**Ingest all the tasks, run celery to trigger the log parsing, and performance data ingestion:**

> **Warning:** This command can take a long time to ingest and parse everything.

```bash
docker-compose exec backend ./manage.py ingest push -p autoland -r 1ee42a54a431acdd6cbe43b49de0237fe67eddd9 -a --enable-eager-celery
```

`--enable-eager-celery` triggers the log parsing which is required to capture the `PERFHERDER_DATA` output.

**For ingesting multiple pushes:**

```bash
docker-compose exec backend ./manage.py ingest push -p autoland --last-n-pushes 100
```
