# Pulse Ingestion Configuration

Running `docker compose up` starts a Pulse listener that ingests live data from the
`autoland` and `try` repositories. It needs your own **Pulse User** on [Pulse Guardian];
Pulse does not allow guest accounts to create queues and Treeherder ships no shared
credentials. Without `PULSE_URL` the listener exits and the rest of the stack runs
normally, so you can also skip this page and use
[manual ingestion](installation.md#manual-ingestion).

You can configure ingestion in the following ways:

1. Create a **Pulse User** on [Pulse Guardian] (required for live ingestion)
2. Specify a custom set of repositories for which to ingest data

## Pulse Guardian

Visit [Pulse Guardian], sign in, and create a **Pulse User**. It will ask you to set a
username and password. Remember these as you'll use them in the next step. If the
listener later logs `ACCESS_REFUSED - Login was refused`, the password is wrong or has
been reset; update it on Pulse Guardian and in your `.env`.

If your **Pulse User** was username: `foo` and password: `bar`, your Pulse URL
would be:

`amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1`

<!-- prettier-ignore -->
!!! note
    Be sure you do **NOT** use quotes when setting the value of PULSE_URL.  Otherwise, you may get an
    error: ``KeyError: 'No such transport: '``

Add it to the `.env` file in the repository root, substituting the url above:

```bash
PULSE_URL=amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1
```

Docker Compose reads `.env` automatically. See
[Configuring with a `.env` file] and [Starting a local Treeherder instance] for more info.

## Custom list of Repositories

`docker-compose.yml` defaults `PROJECTS_TO_INGEST` to `autoland,try`. To change it, set
it in `.env`:

```bash
PROJECTS_TO_INGEST=autoland,try,mozilla-central
```

Pushes and tasks for other repositories are received from Pulse but ignored.

## Skipping ingestion

If you only need the UI and API, for example against a remote database, set
`SKIP_INGESTION=True` and the listener will not connect to Pulse at all.

[configuring with a `.env` file]: installation.md#configuring-with-a-env-file
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
