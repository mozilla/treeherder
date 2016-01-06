Retrieving Data
===============

Treeherder REST API
-------------------

Treeherder provides a REST API which can be used to query for all the
resultset, job, and performance data it stores internally. To allow
inspection of this API, we use Swagger_, which provides a friendly
browsable interface to Treeherder's API endpoints. After setting up a
local instance of treeherder, you can access Swagger at
http://local.treeherder.mozilla.org/docs/. You can also view it on
our production instance at https://treeherder.mozilla.org/docs/.

.. _Swagger: http://swagger.io/


Python Client
-------------

The treeherder-client library described in :doc:`submitting_data`
also has some convenience methods to query the Treeherder API. It is
still in active development, but already has methods for getting
resultset and job information.

Here's a simple example which prints the start timestamp of all the
jobs associated with the last 10 result sets on mozilla-central:

.. code-block:: python

    from thclient import TreeherderClient

    client = TreeherderClient(protocol='https', host='treeherder.mozilla.org')

    resultsets = client.get_resultsets('mozilla-central') # gets last 10 by default
    for resultset in resultsets:
        jobs = client.get_jobs('mozilla-central', result_set_id=resultset['id'])
        for job in jobs:
            print job['start_timestamp']
