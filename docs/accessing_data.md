# Accessing Treeherder's data

Treeherder's data can be accessed via:

- [REST API](#rest-api)
- [Redash](#redash)
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

## Redash

Mozilla's [Redash] instance at <https://sql.telemetry.mozilla.org> is configured to use
Treeherder's read-only MySQL replica as a data source. Users with LDAP credentials
can find Treeherder's data under the `Treeherder` data source and cross-reference it with
other data sets available there.

[redash]: https://redash.io

## Direct database access

If the use-cases above aren't sufficient or you're working on a fullstack Perfherder bug,
we can provide read-only access to Treeherder's stage MySQL replica.
Please [file a bug] requesting that someone from the cloudOps team grant access to the read-only stage replica.
Be sure to follow the instructions for [connecting to the databases](#connecting-to-databases) if you're using it
outside of the docker container.

For users with permission to access the prototype database locally, you'll need to export `TLS_CERT_PATH='deployment/gcp/ca-cert-prototype.pem'`, or pass it as an argument along with the DATABASE_URL, so that SSL connections are made with the appropriate certificate in the docker container.

<!-- prettier-ignore -->
!!! note
    You won't be able to login when using a read-only replica like the above.

### Connecting to databases

Connections **must** be made using TLS otherwise the connection will fail, but not before
having already leaked the credentials over plain-text.

A tool such as [MySQL Workbench] is recommended, since it's possible to save connection
settings for each database, speeding up future use and reducing the chance of forgetting
to enable TLS.

When setting up a connection make sure to change the "Use SSL" option to `require` and set
the "SSL CA File" option to point at the public CA certificate, which for convenience can
be used directly from the Treeherder repository [here][gcp-cert] for the stage replica or
[here][gcp-prototype-cert] for prototype.

[MySQL workbench]: https://www.MySQL.com/products/workbench/
[gcp-cert]: https://github.com/mozilla/treeherder/blob/master/deployment/gcp/ca-cert.pem
[gcp-prototype-cert]: https://github.com/mozilla/treeherder/blob/master/deployment/gcp/ca-cert-prototype.pem

You can alternatively connect to a staging database with a read-only proxy server. To do this follow these for credentials and treeherder setup:

1. [File a Jira ticket here](https://mozilla-hub.atlassian.net/jira/software/c/projects/SVCSE/boards/316) to get
credentials to access the databases, give the ticket a title of "Request credentials for Treeherder's Staging database"
2. Once the credentials are provided, edit the .env to contain: `DATABASE_URL=psql://username:password@host.docker.internal:5432/treeherder` with the credentials that were provided
3. Edit docker/entrypoint.sh to contain:

```shell
# Keep these in sync with DATABASE_URL.
echo "Checking database status at $DATABASE_URL"
if [[ ${DATABASE_URL:0:8} == "mysql://" ]]; then
 check_service "MySQL" "mysql" 3306;
fi
if [[ ${DATABASE_URL:0:27} == *"@host.docker.internal"* ]]; then
 check_service "PostgreSQL" "host.docker.internal" 5432;
elseNinN
 check_service "PostgreSQL" "postgres" 5432;
fi
```

Then, in your local Environment run the following:

1. [Download the Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install)
2. [Follow the steps in the Treeherder Dev Resources](https://mozilla-hub.atlassian.net/wiki/spaces/SRE/pages/671514712/Treeherder+Dev+Resources#Database-Instance-Names) the steps being:
   1) Run `gcloud auth login --update-adc`
   2) Run `./cloud-sql-proxy --address 127.0.0.1 --port 5432 moz-fx-treeherde-nonprod-34ec:us-west1:treeherder-nonprod-stage-v1-postgres-replica-0`

Notes:

- If you’re having issues on linux related to endpoint postgres, and/or bind: address already in use you can try changing the port in the postgres container to 5432 to 5433, and keeping the rest of the commands the same
- To find instance connection name for stage run `gcloud sql instances describe treeherder-nonprod-stage-v1-postgres-replica-0 --project moz-fx-treeherde-nonprod-34ec --format='value(connectionName)'`
- Then copy the resulted *instance connection name* which should be `moz-fx-treeherde-nonprod-34ec:us-west1:treeherder-nonprod-stage-v1-postgres-replica-0`
- It may be required to add `extra_hosts: - "host.docker.internal:host-gateway"` to the backend container and to use 0.0.0.0 instead of 127.0.0.1 in the cloud-sql-proxy command
- The check services calls may fail or hang, if you're having issues with this try removing those comments from the command block linked above

## Import performance data from upstream

If the use-cases above still aren't enough, you should ask for read-only access to one of
Treeherder's MySQL replicas. Please [file a bug] requesting that
someone from the cloudOps team grant access to the read-only replica.

You should be given the credentials in [connection URL format].

Once you have the connection URL pointing to the MySQL replica, please create a local
`.env` in the root of the project and assign the URL to a variable there.
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

[file a bug]: https://bugzilla.mozilla.org/enter_bug.cgi?product=Cloud%20Services&component=Operations%3A%20Releng
[connection URL format]: https://dev.mysql.com/doc/connector-j/8.0/en/connector-j-reference-jdbc-url-format.html
[start a local Treeherder instance]: installation.md#starting-a-local-treeherder-instance
