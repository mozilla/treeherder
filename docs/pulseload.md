# Loading Pulse data

For ingestion from **Pulse** exchanges, on your local machine, you can choose
to ingest from any exchange you like. Some exchanges will be registered in
`settings.py` for use by the Treeherder servers. You can use those to get the
same data as Treeherder. Or you can specify your own and experiment with
posting your own data.

## The Simple Case

If you just want to get the same data that Treeherder gets, then you have 3 steps:

1. Create a user on [Pulse Guardian] if you don't already have one
2. Create your `PULSE_URL` string
3. Run a backend Docker container to read Pushes
4. Run a backend Docker container to read Jobs
5. Run a backend Docker container for **Celery**

### 1. Pulse Guardian

Visit [Pulse Guardian], sign in, and create a **Pulse User**. It will ask you to set a
username and password. Remember these as you'll use them in the next step.
Unfortunately, **Pulse** doesn't support creating queues with a guest account, so
this step is necessary.

### 2. Environment Variable

If your **Pulse User** was username: `foo` and password: `bar`, your config
string would be:

`amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1`

### 3. Read Pushes

On the **host machine**, set your Pulse config environment variable, so that it's available
for docker-compose to use:

```bash
export PULSE_URL="amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1"
```

Next, run the Treeherder management command to read Pushes from the default **Pulse**
exchange:

```bash
docker-compose run -e PULSE_URL backend ./manage.py pulse_listener_pushes
```

You will see a list of the exchanges it has mounted to and a message for each
push as it is read. This process does not ingest the push into Treeherder. It
adds that Push message to a local **Celery** queue for ingestion. They will be
ingested in step 5.

### 4. Read Jobs

As in step 3, open a new terminal and export your `PULSE_URL` variable.

Then run the management command for listing to jobs:

```bash
docker-compose run -e PULSE_URL backend ./manage.py pulse_listener_jobs
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

`treeherder.services.pulse.sources` provides default sources for both Jobs and Pushes.

#### Pushes

`push_sources` defines a list of exchanges with routing keys.
It's rare you'll need to change this so it's not configurable via the environment.
However if you wanted to, say, only get pushes to GitHub you would edit the list to look like this:

```python
push_sources = [
    "exchange/taskcluster-github/v1/push.#",
]
```

#### Jobs

Job Exchanges and Projects are defined in `job_sources`, however can
also be configured in the environment like so:

`PULSE_JOB_SOURCES` defines a list of exchanges with projects.

```bash
export PULSE_JOB_SOURCES="exchange/taskcluster-treeherder/v1/jobs.mozilla-central:mozilla-inbound,exchange/fxtesteng/jobs.#",
```

In this example we've defined two exchanges:

- `exchange/taskcluster-treeherder/v1/jobs`
- `exchange/fxtesteng/jobs`

The taskcluster-treeherder exchange defines two projects:

- `mozilla-central`
- `mozilla-inbound`

The `fxtesteng` exchange defines a wildcard (`#`) for its project.

When Jobs are read from Pulse and added to Treeherder's celery queue we generate a routing key by prepending `#.` to each project key.

### Advanced Celery options

If you only want to ingest the Pushes and Jobs, but don't care about log parsing
and all the other processing Treeherder does, then you can minimize the **Celery**
task. You will need:

```bash
celery -A treeherder worker -B -Q pushlog,store_pulse_jobs,store_pulse_pushes --concurrency 5
```

- The `pushlog` queue loads up to the last 10 Mercurial pushes that exist.
- The `store_pulse_pushes` queue will ingest all the pushes from the exchanges
  specified in `push_sources`. This can be Mercurial and Github
- The `store_pulse_jobs` queue will ingest all the jobs from the exchanges
  specified in `job_sources` (or `PULSE_JOB_SOURCES`).

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

You can use the handy [Pulse Inspector] to view messages in your exchange to
test that they are arriving at Pulse the way you expect.

[pulse guardian]: https://pulseguardian.mozilla.org/whats_pulse
[pulse inspector]: https://tools.taskcluster.net/pulse-inspector/
[yml schema]: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
