# Submitting data to Treeherder

To submit your test data to Treeherder, you have two options:

1. Using Taskcluster (recommended)

   It's strongly recommended that you schedule jobs using Taskcluster rather
   than using your own build system, since otherwise many Treeherder features
   will not work without significant effort, and it's also unlikely your jobs
   will be eligible for tier 1 or even tier 2 status.

2. [Using Pulse](#using-pulse)

   This is the process Taskcluster is using to submit data to Treeherder.
   There is a [Pulse Job Schema] to validate your payload against to ensure it will
   be accepted. In this case, you create your own [Pulse] exchange and publish
   to it. To get Treeherder to receive your data, you would create a bug to
   have your Exchange added to Treeherder's config. All Treeherder instances
   can subscribe to get your data, as can local dev instances for testing.

   While it is beyond the scope of this document to explain how [Pulse] and
   RabbitMQ work, we encourage you to read more about this technology on
   its Wiki page.

   Note: Support for submitting data using Pulse outside of Taskcluster may
   be removed in the future.

If you are establishing a new repository with Treeherder, then you will need to
do one of the following:

1. For GitHub repos: [Adding a GitHub Repository](#adding-a-github-repository)

2. For Mercurial repos: [Add a new Mercurial repository](common_tasks.md#add-a-new-mercurial-repository)

## Using Pulse

To submit via a Pulse exchange, these are the steps you will need to follow:

### 1. Format your data

You should format your job data according to the [Pulse Job Schema],
which describes the various properties of a job: whether it passed or failed,
job group/type symbol, description, log information, etc.
You are responsible for validating your data prior to publishing it onto your
exchange, or Treeherder may reject it.

### 2. Create your Exchange

With [Pulse Guardian], you need to create your Pulse User in order to
create your own Queues and Exchanges. There is no mechanism to create an
Exchange in the Pulse Guardian UI itself, however. You will need to create
your exchange in your submitting code. There are a few options available
for that:

1. [MozillaPulse]
2. [Kombu]
3. Or any RabbitMQ package of your choice

To test publishing your data to your Exchange, you can use the Treeherder
management command [publish_to_pulse]. This is also a very simple example
of a Pulse publisher using Kombu that you can use to learn to write your own
publisher.

### 3. Register with Treeherder

Once you have successfully tested a round-trip through your Pulse exchange to
your development instance, you are ready to have Treeherder receive your data.

Treeherder has to know about your exchange and which routing keys to use in
order to load your jobs.

Submit a [Treeherder bug] with the following information:

```python
{
    "exchange": "exchange/my-pulse-user/v1/jobs",
    "projects": [
        'mozilla-inbound._'
    ],
},
```

Treeherder will bind to the exchange looking for all combinations of it and the
`projects`. For example with the above config, we will only load jobs from
the `mozilla-inbound._` project.

If you want all jobs from your exchange to be loaded, you can use the `#`
wildcard like so:

```python
"projects": [
    '#'
],
```

If you want one config to go to Treeherder Staging and a different one to go
to Production, please specify that in the bug. You could use the same exchange
with different project settings, or two separate exchanges. The choice is
yours.

### 4. Publish jobs to your Exchange

Once the above config is set on Treeherder, you can begin publishing jobs
to your Exchange and they will start showing in Treeherder.

You will no longer need any special credentials. You publish messages to the
Exchange YOU own. Treeherder is now just listening to it.

## Schema Validation

Some data types in Treeherder will have JSON Schema files in the form of YAML.
You can use these files to validate your data prior to submission to be sure
it is in the right format.

You can find all our data schemas in the [schemas] folder.

To validate your file against a `yml` file, you can use something like the
following example code:

```python
import yaml
import jsonschema

with open('schemas/text-log-summary-artifact.yml') as f:
    schema = yaml.load(f, Loader=yaml.FullLoader)

jsonschema.validate(data, schema)
```

This will give output telling you if your `data` element passes validation,
and, if not, exactly where it is out of compliance.

[schemas]: https://github.com/mozilla/treeherder/tree/master/schemas

## Adding a GitHub Repository

The pushes from GitHub repos come to Treeherder via Pulse. The webhook to enable
this exists in the GitHub group `mozilla`. (For example, `github.com/mozilla/treeherder`)

The following steps are required:

1. Create a PR with the new repository information added to the fixtures file:
   `treeherder/model/fixtures/repository.json`

2. Open a bug request to enable the webhook that will trigger pulse messages for
   every push from your repo. Use the following information:

   - Component: GitHub: Administration
   - Ask to install the <https://github.com/apps/taskcluster> integration on your repositories
   - List the repositories you want to have access to the integration
   - Answer: Are any of those repositories private?
   - State that this is only to get Pulse messages for integration into Treeherder

[pulse guardian]: https://pulseguardian.mozilla.org/whats_pulse
[pulse]: https://wiki.mozilla.org/Auto-tools/Projects/Pulse
[pulse job schema]: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
[treeherder bug]: https://bugzilla.mozilla.org/enter_bug.cgi?component=Treeherder:%20Data%20Ingestion&form_name=enter_bug&product=Tree%20Management
[mozillapulse]: https://pypi.python.org/pypi/MozillaPulse
[kombu]: https://pypi.python.org/pypi/kombu
[publish_to_pulse]: https://github.com/mozilla/treeherder/blob/master/treeherder/etl/management/commands/publish_to_pulse.py#L12-L12
