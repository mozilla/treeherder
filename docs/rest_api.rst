REST API
========

Treeherder provides a REST API which can be used to query for all the
resultset, job, and performance data it stores internally. To allow
inspection of this API, we use Swagger_, which provides a friendly
browsable interface to Treeherder's API endpoints. After setting up a
local instance of treeherder, you can access Swagger at
http://local.treeherder.mozilla.org/docs/. You can also view it on
our production instance at https://treeherder.mozilla.org/docs/.

.. _Swagger: http://swagger.io/


.. _python-client:

Python Client
-------------

We provide a library, called treeherder-client, to simplify
interacting with the REST API. It is maintained inside the
Treeherder repository, but you can install your own copy from pypi
using pip:

.. code-block:: bash

    pip install treeherder-client


.. _authentication:

Authentication
--------------

A treeherder client instance should identify itself to the server
via the `Hawk authentication mechanism`_. To apply for credentials or
create some for local testing, see :ref:`managing-api-credentials`
below.

Once your credentials are set up, pass them via the `client_id` and
`secret` parameters to TreeherderClient's constructor:

.. code-block:: python

    client = TreeherderClient(protocol='https', host='treeherder.mozilla.org', client_id='hawk_id', secret='hawk_secret')
    client.post_collection('mozilla-central', tac)

Note: The system clock on the machines making requests must be correct
(or more specifically, within 60 seconds of the Treeherder server time),
otherwise authentication will fail.

.. _Hawk authentication mechanism: https://github.com/hueniverse/hawk
