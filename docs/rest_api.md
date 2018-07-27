REST API
========

Treeherder provides a REST API which can be used to query for all the
push, job, and performance data it stores internally. For a browsable
interface, see:
<https://treeherder.mozilla.org/docs/>


Python Client
-------------

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

For verbose output, pass ``level=logging.DEBUG`` to ``basicConfig()``.


User Agents
-----------

When interacting with Treeherder's API, you must set an appropriate
``User Agent`` header (rather than relying on the defaults of your
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


Authentication
--------------

A Treeherder client instance should identify itself to the server
via the [Hawk authentication mechanism]. To apply for credentials or
create some for local testing, see [Managing API Credentials](#managing-api-credentials)
below.

Once your credentials are set up, if you are using the Python client
pass them via the `client_id` and `secret` parameters to
TreeherderClient's constructor:

```python
client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')
client.post_collection('mozilla-central', tac)
```

Remember to point the Python client at the Treeherder instance to which
the credentials belong - see [here](#python-client) for more details.

To diagnose problems when authenticating, ensure Python logging has been
set up (see [Python Client](#python-client)).

Note: The system clock on the machines making requests must be correct
(or more specifically, within 60 seconds of the Treeherder server time),
otherwise authentication will fail. In this case, the response body will be:

```json
{"detail": "Hawk authentication failed: The token has expired. Is your system clock correct?"}
```

[Hawk authentication mechanism]: https://github.com/hueniverse/hawk


Managing API credentials
------------------------

Submitting data via the REST API has been deprecated in favour of Pulse
([bug 1349182](https://bugzilla.mozilla.org/show_bug.cgi?id=1349182)).

As such we are no longer issuing Hawk credentials for new projects,
and the UI for requesting/managing credentials has been removed.
