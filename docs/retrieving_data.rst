Retrieving Data
===============

The :ref:`Python client <python-client>` also has some convenience
methods to query the Treeherder API. It is still in active development,
but already has methods for getting push and job information.

See the :ref:`Python client <python-client>` section for how to control
which Treeherder instance will be accessed by the client.

Here's a simple example which prints the start timestamp of all the
jobs associated with the last 10 pushes on mozilla-central:

.. code-block:: python

    from thclient import TreeherderClient

    client = TreeherderClient()

    pushes = client.get_pushes('mozilla-central') # gets last 10 by default
    for pushes in pushes:
        jobs = client.get_jobs('mozilla-central', push_id=pushes['id'])
        for job in jobs:
            print job['start_timestamp']
