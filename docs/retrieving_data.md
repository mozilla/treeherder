Retrieving Data
===============

The [Python client](rest_api.html#python-client) also has some convenience
methods to query the Treeherder API.

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
