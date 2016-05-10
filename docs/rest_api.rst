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

      (venv)vagrant@local:~/treeherder$ ./manage.py create_credentials my-client-id treeherder@mozilla.com "Description"

The generated Hawk ``secret`` will be output to the console, which should then
be passed along with the chosen ``client_id`` to the TreeherderClient constructor.
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
