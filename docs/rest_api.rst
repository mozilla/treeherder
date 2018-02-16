REST API
========

Treeherder provides a REST API which can be used to query for all the
push, job, and performance data it stores internally. For a browsable
interface, see:
https://treeherder.mozilla.org/docs/


.. _python-client:

Python Client
-------------

We provide a library, called treeherder-client, to simplify
interacting with the REST API. It is maintained inside the
Treeherder repository, but you can install your own copy from PyPI
using pip:

.. code-block:: bash

    pip install treeherder-client

It will install a module called `thclient` that you can access, for example:

.. code-block:: python

    from thclient import TreeherderClient

By default the production Treeherder API will be used, however this can be
overridden by passing a `server_url` argument to the `TreeherderClient`
constructor:

.. code-block:: python

    # Treeherder production
    client = TreeherderClient()

    # Treeherder stage
    client = TreeherderClient(server_url='https://treeherder.allizom.org')

    # Local vagrant instance
    client = TreeherderClient(server_url='http://localhost:8000')

When using the Python client, don't forget to set up logging in the
caller so that any API error messages are output, like so:

.. code-block:: python

    import logging

    logging.basicConfig()

For verbose output, pass ``level=logging.DEBUG`` to ``basicConfig()``.


User Agents
-----------

When interacting with Treeherder's API, you must set an appropriate
``User Agent`` header (rather than relying on the defaults of your
language/library) so that we can more easily track API feature usage,
as well as accidental abuse. Default scripting User Agents will receive
an HTTP 403 response (see `bug 1230222`_ for more details).

If you are using the :ref:`python-client`, an appropriate User Agent
is set for you. When using the Python requests library, the User Agent
can be set like so:

.. code-block:: python

    r = requests.get(url, headers={'User-Agent': ...})

.. _bug 1230222: https://bugzilla.mozilla.org/show_bug.cgi?id=1230222


.. _authentication:

Authentication
--------------

A Treeherder client instance should identify itself to the server
via the `Hawk authentication mechanism`_. To apply for credentials or
create some for local testing, see :ref:`managing-api-credentials`
below.

Once your credentials are set up, if you are using the Python client
pass them via the `client_id` and `secret` parameters to
TreeherderClient's constructor:

.. code-block:: python

    client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')
    client.post_collection('mozilla-central', tac)

Remember to point the Python client at the Treeherder instance to which
the credentials belong - see :ref:`here <python-client>` for more details.

To diagnose problems when authenticating, ensure Python logging has been
set up (see :ref:`python-client`).

Note: The system clock on the machines making requests must be correct
(or more specifically, within 60 seconds of the Treeherder server time),
otherwise authentication will fail. In this case, the response body will be:

.. code-block:: json

    {"detail":"Hawk authentication failed: The token has expired. Is your system clock correct?"}

.. _Hawk authentication mechanism: https://github.com/hueniverse/hawk


.. _managing-api-credentials:

Managing API credentials
------------------------

Submitting data via the REST API has been deprecated in favour of Pulse
(`bug 1349182 <https://bugzilla.mozilla.org/show_bug.cgi?id=1349182>`__).

As such we are no longer issuing Hawk credentials for new projects,
and the UI for requesting/managing credentials has been removed.
