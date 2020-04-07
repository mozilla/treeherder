# Loading Pulse data

For ingestion from **Pulse** exchanges, on your local machine, you can choose
to ingest from any exchange you like. Some exchanges will be registered in
`sources.py` for use by the Treeherder servers. You can use those to get the
same data as Treeherder. Or you can specify your own and experiment with
posting your own data.

## The Simple Case

If you just want to get the same data that Treeherder gets, then you have 3 steps:

1. Create a user on [Pulse Guardian] if you don't already have one, and determine a Pulse URL for it
2. Run a backend Docker container to read Pushes
3. Run a backend Docker container to read Tasks
4. Run a backend Docker container for **Celery**

### 1. Pulse Guardian

Visit [Pulse Guardian], sign in, and create a **Pulse User**. It will ask you to set a
username and password. Remember these as you'll use them in the next step.
Unfortunately, **Pulse** doesn't support creating queues with a guest account, so
this step is necessary.

If your **Pulse User** was username: `foo` and password: `bar`, your Pulse URL
would be:

`amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1`

### 2. Read Pushes

You will need the root URL for the Taskcluster deployment, such as `https://firefox-ci-tc.services.mozilla.com`.

NOTE: If you use PULSE_URL you will not need to configure the other env variables.

On your localhost set PULSE_URL or PULSE_PUSH_SOURCES as follows, subsituting the appropriate URLs:

```bash
export PULSE_URL=<pulse url>
# OR
export PULSE_PUSH_SOURCES='[{"root_url": "<root url>", "github": true, "hgmo": true, "pulse_url": "<pulse url>"}]'
```

If the deployment doesn't connect with github or `hg.mozilla.org`, omit the `github` and `hgmo` properties, respectively.

Next, run the Treeherder management command to read Pushes from the default **Pulse**
exchange:

```bash
docker-compose run -e PULSE_URL backend ./manage.py pulse_listener_pushes
# OR
docker-compose run -e PULSE_PUSH_SOURCES backend ./manage.py pulse_listener_pushes
```

You will see a list of the exchanges it has mounted to and a message for each
push as it is read. This process does not ingest the push into Treeherder. It
adds that Push message to a local **Celery** queue for ingestion. They will be
ingested in step 5.

### 4. Read Tasks

As in step 3, open a new terminal and this time create `PULSE_TASK_SOURCES`:

```bash
export PULSE_URL=<pulse url>
# OR
export PULSE_TASK_SOURCES='[{"root_url": "<root url>", "pulse_url": "<pulse url>"}]'
```

Then run the management command for listing to jobs:

```bash
docker-compose run -e PULSE_URL backend ./manage.py pulse_listener_pushes
# OR
docker-compose run -e PULSE_TASK_SOURCES backend ./manage.py pulse_listener_tasks
```

You will again see the list of exchanges that your queue is now mounted to and
a message for each Job as it is read into your local **Celery** queue.

### 5. Celery

Open your next terminal. You don't need to set your environment variable
in this one. Just run **Celery**:

```bash
docker-compose run backend celery -A treeherder worker -B --concurrency 5
```

That's it! With those processes running, you will begin ingesting Treeherder
data. To see the data, you will need to run the Treeherder UI and API.
See [Starting a local Treeherder instance] for more info.

[starting a local treeherder instance]: installation.md#starting-a-local-treeherder-instance

## Advanced Configuration

### Changing which Data to Ingest

Both `PULSE_TASK_SOURCES` and `PULSE_PUSH_SOURCES` are JSON arrays containing the sources from which you wish to ingest.
`PULSE_PUSH_SOURCES` allows configuration of the types of pushes to listen for -- `github` or `hgmo`.

### Advanced Celery options

If you only want to ingest the Pushes and Tasks, but don't care about log parsing
and all the other processing Treeherder does, then you can minimize the **Celery**
task. You will need:

```bash
celery -A treeherder worker -B -Q pushlog,store_pulse_tasks,store_pulse_pushes --concurrency 5
```

- The `pushlog` queue loads up to the last 10 Mercurial pushes that exist.
- The `store_pulse_pushes` queue will ingest all the pushes from the exchanges
  specified in `push_sources`. This can be Mercurial and Github
- The `store_pulse_tasks` queue will ingest all the jobs from the exchanges
  specified in `task_sources` (or `PULSE_TASK_SOURCES`).

<!-- prettier-ignore -->
!!! note
    Any job that comes from Pulse that does not have an associated push will be skipped.

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
