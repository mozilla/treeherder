# Accessing Treeherder's data

Treeherder's data can be accessed via:

- [REST API](#rest-api)
- [GraphQL API](#graphql-api)
- [Redash](#redash)
- [ActiveData](#activedata)
- [Direct database access](#direct-database-access)
- [Import performance data from upstream](#import-performance-data-from-upstream)

## REST API

Treeherder provides a REST API which can be used to query for all the
push, job, and performance data it stores internally. For a browsable
interface, see:

<https://treeherder.mozilla.org/docs/>

### Python Client

We provide a library, called treeherder-client, to simplify
interacting with the REST API. It is maintained inside the
Treeherder repository, but you can install your own copy from PyPI
using pip:

```bash
pip install treeherder-client
```

It will install a module called `thclient` that you can access, for example:

```python
from thclient import TreeherderClient
```

By default the production Treeherder API will be used, however this can be
overridden by passing a `server_url` argument to the `TreeherderClient`
constructor:

```python
# Treeherder production
client = TreeherderClient()

# Treeherder stage
client = TreeherderClient(server_url='https://treeherder.allizom.org')

# Local vagrant instance
client = TreeherderClient(server_url='http://localhost:8000')
```

The Python client has some convenience methods to query the Treeherder API.

Here's a simple example which prints the start timestamp of all the
jobs associated with the last 10 pushes on mozilla-central:

```python
from thclient import TreeherderClient

client = TreeherderClient()

pushes = client.get_pushes('mozilla-central') # gets last 10 by default
for pushes in pushes:
    jobs = client.get_jobs('mozilla-central', push_id=pushes['id'])
    for job in jobs:
        print job['start_timestamp']
```

When using the Python client, don't forget to set up logging in the
caller so that any API error messages are output, like so:

```python
import logging

logging.basicConfig()
```

For verbose output, pass `level=logging.DEBUG` to `basicConfig()`.

### User Agents

When interacting with Treeherder's API, you must set an appropriate
`User Agent` header (rather than relying on the defaults of your
language/library) so that we can more easily track API feature usage,
as well as accidental abuse. Default scripting User Agents will receive
an HTTP 403 response (see [bug 1230222] for more details).

If you are using the [Python Client](#python-client), an appropriate User Agent
is set for you. When using the Python requests library, the User Agent
can be set like so:

```python
r = requests.get(url, headers={'User-Agent': ...})
```

[bug 1230222]: https://bugzilla.mozilla.org/show_bug.cgi?id=1230222

## GraphQL API

This API is a work in progress. A browsable interface is available at:

<https://treeherder.mozilla.org/graphql>

## Redash

Mozilla's [Redash] instance at <https://sql.telemetry.mozilla.org> is configured to use
Treeherder's read-only MySQL RDS replica as a data source. Users with LDAP credentials
can find Treeherder's data under the `Treeherder` data source and cross-reference it with
other data sets available there.

[redash]: https://redash.io

## ActiveData

[ActiveData] imports Treeherder's production data into its Elasticsearch cluster.
See the [getting started with ActiveData] guide for more details.

[activedata]: https://wiki.mozilla.org/EngineeringProductivity/Projects/ActiveData
[getting started with activedata]: https://github.com/mozilla/ActiveData/blob/dev/docs/GettingStarted.md

## Direct database access

If the use-cases above aren't sufficient or you're working on a fullstack Perfherder bug, 
we can provide read-only access to Treeherder's production MySQL RDS replica.
Please [file an infrastructure bug] requesting that someone from the
Treeherder team [grant access to the read-only replica].

<!-- prettier-ignore -->
!!! note
    You won't be able to login when using a read-only replica like the above.

Alternatively if write access is required, we can [create a temporary RDS instance] from
a production database snapshot.

## Import performance data from upstream

If the use-cases above still aren't enough, you should ask for read-only access to one of
Treeherder's MySQL RDS replicas. Please [file an infrastructure bug] requesting that
someone from the Treeherder team [grant access to the read-only replica].

You should be given the credentials in [connection URL format].

Once you have the connection URL pointing to the MySQL replica, please provide it in the `.env` local file.
It should look something like this:

```bash
UPSTREAM_DATABASE_URL=mysql://<username>:<password>@<database_host>/treeherder
```

Now you're ready to import real data, right from the upstream database!

First, [start a local Treeherder instance]. Once that's up, connect to the backend container using:

```bash
docker container exec -it backend bash
```

From there, just use the `import_perf_data` Django management command.
A typical import looks like the following:

```bash
./manage.py import_perf_data --time-window 2 --frameworks raptor talos --repositories autoland mozilla-beta --num-workers 4
```

In about 10 minutes you should have a subset of that data available on your local database.
The example above fetches 2 days worth of performance data, originating from 2 frameworks and 2 repositories.

If you need to edit the performance data from the frontend's UI, some extra steps are needed.

You have to grant your account perf sheriff rights.
To do that, make sure you've logged in from the UI.

Using your favourite SQL client, enter your local database and query the `auth_user` table, looking for the record
associated to your account. The `username` column should contain something like `mozilla-ldap/<your_login_email>`.
Once you identify the correct row, set its `is_staff` field to 1 and that's it!

[file an infrastructure bug]: https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder%3A%20Infrastructure
[grant access to the read-only replica]: infrastructure/administration.md#granting-access-to-the-read-only-replica
[create a temporary rds instance]: infrastructure/administration.md#creating-a-temporary-instance
[connection URL format]: https://dev.mysql.com/doc/connector-j/8.0/en/connector-j-reference-jdbc-url-format.html
[start a local Treeherder instance]: installation.md#starting-a-local-treeherder-instance
