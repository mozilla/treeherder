REST API
========

Treeherder provides a REST API which can be used to query for all the
resultset, job, and performance data it stores internally. To allow
inspection of this API, we use Swagger_, which provides a friendly
browsable interface to Treeherder's API endpoints. After setting up a
local instance of Treeherder, you can access Swagger at
http://localhost:8000/docs/. You can also view it on
our production instance at https://treeherder.mozilla.org/docs/.

.. _Swagger: http://swagger.io/


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

    r = requests.get(url, headers={'User Agent': ...})

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

To submit data to Treeherder's API you need Hawk credentials,
even if you're submitting to your local server. The recommended
process is slightly different for a development server versus
submitting to Treeherder staging or production, see below for
details.

Generating and using credentials on a local testing instance
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To generate credentials in the Vagrant instance run the following:

  .. code-block:: bash

      vagrant ~/treeherder$ ./manage.py create_credentials my-client-id

The generated Hawk ``secret`` will be output to the console, which should then
be passed along with the chosen ``client_id``, and Vagrant instance ``server_url``
to the TreeherderClient constructor.
For more details see the :doc:`submitting_data` section.

Generating and using credentials on treeherder stage or production
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Users can generate credentials for the deployed Mozilla Treeherder instances
(and view/delete existing ones) using the forms here:
`stage <https://treeherder.allizom.org/credentials/>`__ /
`production <https://treeherder.mozilla.org/credentials/>`__.
It is recommended that the same ``client_id`` string be used for both stage
and production. Once you've created your set of credentials, you can get
access to the Hawk ``secret`` by clicking on the link that should appear on the
credentials list page.

The credentials must be marked as approved by a Treeherder admin before they can
be used for submitting to the API. Request this for stage first, by filing a bug in
`Treeherder: API <https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder%3A%20API>`__.
Once any submission issues are resolved on stage, file a new bug requesting
approval for production.

Once the credentials are approved, they may be used exactly in exactly
the same way as with a local testing instance (see above).

Treeherder administrators can manage credentials here:
`stage <https://treeherder.allizom.org/admin/credentials/credentials/>`__ /
`production <https://treeherder.mozilla.org/admin/credentials/credentials/>`__.
Note: Bugs must be filed to document all approvals & changes, to ease debugging
and coordinating with credential owners in case of any later issues.
