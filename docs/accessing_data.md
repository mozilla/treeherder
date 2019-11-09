# Accessing Treeherder's data

Treeherder's data can be accessed via:

- [REST API](#rest-api)
- [GraphQL API](#graphql-api)
- [Redash](#redash)
- [ActiveData](#activedata)
- [Direct database access](#direct-database-access)

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

If there are any use-cases that are not possible via one of the above, we can provide read-only
access to Treeherder's production MySQL RDS replica. Please [file an infrastructure bug]
requesting that someone from the Treeherder team [grant access to the read-only replica].

Alternatively if write access is required, we can [create a temporary RDS instance] from
a production database snapshot.

[file an infrastructure bug]: https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder%3A%20Infrastructure
[grant access to the read-only replica]: infrastructure/administration.md#granting-access-to-the-read-only-replica
[create a temporary rds instance]: infrastructure/administration.md#creating-a-temporary-instance
