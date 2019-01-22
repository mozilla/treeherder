# REST API

Treeherder provides a REST API which can be used to query for all the
push, job, and performance data it stores internally. For a browsable
interface, see:
<https://treeherder.mozilla.org/docs/>

## Profiling API endpoint performance

On our development (vagrant) instance we have [django-debug-toolbar](http://django-debug-toolbar.readthedocs.io/) installed, which can give
information on exactly what SQL is run to generate individual API
endpoints. Just navigate to an endpoint
(example: <http://localhost:8000/api/repository/>) and
you should see the toolbar to your right.

## Python Client

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

When using the Python client, don't forget to set up logging in the
caller so that any API error messages are output, like so:

```python
import logging

logging.basicConfig()
```

For verbose output, pass `level=logging.DEBUG` to `basicConfig()`.

## User Agents

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
