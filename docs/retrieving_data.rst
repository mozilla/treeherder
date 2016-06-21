Retrieving Data
===============

The :ref:`Python client <python-client>` also has some convenience
methods to query the Treeherder API. It is still in active development,
but already has methods for getting resultset and job information.

See the :ref:`Python client <python-client>` section for how to control
which Treeherder instance will be accessed by the client.

Here's a simple example which prints the start timestamp of all the
jobs associated with the last 10 result sets on mozilla-central:

.. code-block:: python

    from thclient import TreeherderClient

    client = TreeherderClient()

    resultsets = client.get_resultsets('mozilla-central') # gets last 10 by default
    for resultset in resultsets:
        jobs = client.get_jobs('mozilla-central', result_set_id=resultset['id'])
        for job in jobs:
            print job['start_timestamp']
