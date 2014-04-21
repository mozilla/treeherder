treeherder-client
================

A set of client libraries to support data submission to https://github.com/mozilla/treeherder-service. There are two types of data
structures supported: job and resultset collections. Both classes have support methods for building a data structure that https://github.com/mozilla/treeherder-service accepts. Data structures can be extended with new properties as needed, there is a minimal validation protocol applied that confirms the bare minimum parts of the structures are defined.

Resultset Collection
--------------------

Resultset collections contain meta data associated with a github pull request or a push to mercurial or any event that requires tests to be run on a repository. The most critical part of each resultset is the `revision_hash`, this is used as an identifier to associate test job data with. It can be any unique 50 character string. A resultset collection has the following data structure

```python
    [
        {
            # unique identifier for a result set, can be any unique 50 character string
            'revision_hash': '45f8637cb9f78f19cb8463ff174e81756805d8cf',
            'author': 'somebody@somewhere.com',
            'push_timestamp': 1384353511,
            'type': 'push',

            # any type of artifact data associated with the resultset
            'artifact': {
                'type': 'extra_info',
                'name': 'push_data',
                # blob can be any kind of structured data
                'blob': { 'stuff': [1, 2, 3, 4, 5] }
                },

            # a list of revisions associated with the resultset. There should be at least
            # one.
            'revisions': [
                {
                    'comment': 'Bug 936711 - Fix crash which happened at disabling Bluetooth...',
                    'files': [
                        'dom/bluetooth/BluetoothA2dpManager.cpp',
                        'dom/bluetooth/BluetoothHidManager.cpp',
                        'dom/bluetooth/linux/BluetoothDBusService.cpp'
                        ],
                    'revision': 'cdfe03e77e66',
                    'repository': 'test_treeherder',
                    'author': 'Some Person <sperson@someplace.com>'
                    },
                    ...
                ]
            }
        }
    ]
```

Job Collection
--------------

Job collections can contain test results from any kind of test. The `revision_hash` provided should match the associated `revision_hash` in the resultset structure. The `job_guid` provided can be any unique 50 character string. A job collection has the following data structure.

```python
    [
        {
            'project': 'mozilla-inbound',

            'revision_hash': '4317d9e5759d58852485a7a808095a44bc806e19',

            'job': {

                'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33',

                'product_name': 'spidermonkey',

                'reason': 'scheduler',
                'who': 'spidermonkey_info__mozilla-inbound-warnaserr',

                'desc': 'Linux x86-64 mozilla-inbound spidermonkey_info-warnaserr build',

                'name': 'SpiderMonkey --enable-sm-fail-on-warnings Build',

                # The symbol representing the job displayed in
                # treeherder.allizom.org
                'job_symbol': 'e',

                # The symbol representing the job group in
                # treeherder.allizom.org
                'group_symbol': 'SM',
                'group_name': 'SpiderMonkey',

                'submit_timestamp': 1387221298,
                'start_timestamp': 1387221345,
                'end_timestamp': 1387222817,

                'state': 'completed',
                'result': 'success',

                'machine': 'bld-linux64-ec2-104',
                'build_platform': {
                    'platform':'linux64', 'os_name': 'linux', 'architecture': 'x86_64'
                    },
                'machine_platform': {
                    'platform': 'linux64', 'os_name': 'linux', 'architecture': 'x86_64'
                    },

                'build_url': 'https://get.your.builds.here/12345',

                'option_collection': {'opt': True},

                'log_references': [
                    {
                        'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                        'name': 'builds-4h'
                        }
                    ],

                # The artifact can contain any kind of structured data associated with
                # a test. Artifacts can have a name and type. The blob property can
                # contain any valid data structure. Artifacts are retrieved dynamically
                # in https://github.com/mozilla/treeherder-ui when a job is selected
                # in the UI, so the data can be displayed dynamically. See
                # treeherder.allizom.org for some examples.
                'artifact': {
                    'type': '', 'name': '', 'blob': ''
                    },
                },

                # List of job guids that were coalesced to this job
                'coalesced': []
            },
            ...
    ]
```

Artifact Collection
--------------------

Artifact collections contain arbitrary data associated with a job. This is usually a json blob of structured data produced by the build system during the job execution.

```python
    [
        {
            'type': 'json',
            'name': 'my-artifact-name',
            # blob can be any kind of structured data
            'blob': { 'stuff': [1, 2, 3, 4, 5] },
            'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
        }
    ]
```

Usage
-----

If you want to use `TreeherderResultSetCollection` to build up the resultset data structures to send, do something like this.

```python
    from thclient import TreeherderRequest, TreeherderResultSetCollection, TreeherderClientError

    trsc = TreeherderResultSetCollection()

    for data in dataset:

        trs = trsc.get_resultset()

        trs.add_push_timestamp( data['push_timestamp'] )
        trs.add_revision_hash( data['revision_hash'] )
        trs.add_type( data['type'] )
        trs.add_artifact( 'push_data', 'push', { 'stuff':[1,2,3,4,5] } )

        for revision in data['revisions']:

            tr = trs.get_revision()

            tr.add_revision( revision['revision'] )
            tr.add_author( revision['author'] )
            tr.add_comment( revision['comment'] )
            tr.add_files( revision['files'] )
            tr.add_repository( revision['repository'] )

            trs.add_revision(tr)

        trsc.add(trs)

    # Send the collection to treeherder

    # The OAuth key and secret for your project should be supplied to you by the
    # treeherder-service administrator.
    req = TreeherderRequest(
        protocol='https',
        host='treeherder.mozilla.org',
        project='project',
        oauth_key='oauth-key',
        oauth_secret='oauth-secret',
        )

    # Post the result collection
    #
    # data structure validation is automatically performed here, if validation
    # fails a TreeherderClientError is raised
    req.send(trc)
```

At any time in building a data structure, you can examine what has been created by looking at the `data` property. You can also call the `validate` method at any time before sending a collection. All treeherder data classes have `validate` methods that can be used for testing. The `validate` method is called on every structure in a collection when a `send` is called on a `TreeherderRequest`. If validation fails a `TreeherderClientError` is raised.

If you want to use `TreeherderJobCollection` to build up the job data structures to send, do something like this.

```python
    from thclient import TreeherderRequest, TreeherderJobCollection, TreeherderClientError

    #####
    # TreeherderJobCollection() takes a 'type' parameter that can be set to 'update'
    # if the job objects are being used for updating status (status = 'running' | 'pending') and
    # don't contain a full data payload. If type is not set, the job object go to the
    # objectstore (status = 'completed'). If the collection is passed a type like so,
    # TreeherderJobCollection(type='update') the status of the object will be updated in
    # the RDBS schema
    #####
    tjc = TreeherderJobCollection()

    for data in dataset:

        tj = tjc.get_job()

        tj.add_revision_hash( data['revision_hash'] )
        tj.add_project( data['project'] )
        tj.add_coalesced_guid( data['coalesced'] )
        tj.add_job_guid( data['job_guid'] )
        tj.add_job_name( data['name'] )
        tj.add_job_symbol( data['job_symbol'] )
        tj.add_group_name( data['group_name'] )
        tj.add_group_symbol( data['group_symbol'] )
        tj.add_description( data['desc'] )
        tj.add_product_name( data['product_name'] )
        tj.add_state( data['state'] )
        tj.add_result( data['result'] )
        tj.add_reason( data['reason'] )
        tj.add_who( data['who'] )
        tj.add_submit_timestamp( data['submit_timestamp'] )
        tj.add_start_timestamp( data['start_timestamp'] )
        tj.add_end_timestamp( data['end_timestamp'] )
        tj.add_machine( data['machine'] )
        tj.add_build_url( data['build_url'] )

        tj.add_build_info(
            data['build']['os_name'], data['build']['platform'], data['build']['architecture']
            )

        tj.add_machine_info(
            data['machine']['os_name'], data['machine']['platform'], data['machine']['architecture']
            )

        tj.add_option_collection( data['option_collection'] )

        tj.add_log_reference( 'builds-4h', data['log_reference'] )

        tj.add_artifact(
            data['artifact']['name'], data['artifact']['type'], data['artifact']['blob']
            )

        tjc.add(tj)

    # Send the collection to treeherder
    req = TreeherderRequest(
        protocol='https',
        host='treeherder.mozilla.org',
        project='project',
        oauth_key='oauth-key',
        oauth_secret='oauth-secret',
        )

    # Post the job collection
    #
    # data structure validation is automatically performed here, if validation
    # fails a TreeherderClientError is raised
    req.send(tjc)
```

If you want to use `TreeherderArtifactCollection` to build up the job artifacts data structures to send, do something like this.

```python
    from thclient import TreeherderRequest, TreeherderArtifactCollection, TreeherderClientError

    tac = TreeherderArtifactCollection()

    for data in dataset:

        ta = tac.get_artifact()

        ta.add_blob( data['blob'] )
        ta.add_name( data['name'] )
        ta.add_type( data['type'] )
        ta.add_job_guid( data['job_guid'] )

        tac.add(ta)

    # Send the collection to treeherder
    req = TreeherderRequest(
        protocol='https',
        host='treeherder.mozilla.org',
        project='project',
        oauth_key='oauth-key',
        oauth_secret='oauth-secret',
        )

    # Post the artifact collection
    #
    # data structure validation is automatically performed here, if validation
    # fails a TreeherderClientError is raised
    req.send(tac)
```

If you don't want to use `TreeherderResultCollection` or `TreeherderJobCollection` to build up the data structure to send, build the data structures directly and add them to the collection.

```python
    from thclient import TreeherderRequest, TreeherderResultSetCollection

    trc = TreeherderResultSetCollection()

    for resultset in resultset_data:
        trs = trc.get_resultset(resultset)

        # Add any additional data to trs.data here

        # add resultset to collection
        trc.add(trs)

    req = TreeherderRequest(
        protocol='https',
        host='treeherder.mozilla.org',
        project='project',
        oauth_key='oauth-key',
        oauth_secret='oauth-secret',
        )

    # Post the request to treeherder
    req.send(trc)

    from thclient import TreeherderRequest, TreeherderJobCollection

    tjc = TreeherderJobCollection()

    for job in job_data:
        tj = tjc.get_job(job)

        # Add any additional data to tj.data here

        # add job to collection
        tjc.add(tj)

    req = TreeherderRequest(
        protocol='https',
        host='treeherder.mozilla.org',
        project='project',
        oauth_key='oauth-key',
        oauth_secret='oauth-secret',
        )

    # Post the request to treeherder
    #
    # data structure validation is automatically performed here, if validation
    # fails a TreeherderClientError is raised
    req.send(tjc)
```

In the same way, if you don't want to use `TreeherderArtifactCollection` to build up the data structure to send, build the data structures directly and add them to the collection.

```python
    from thclient import TreeherderRequest, TreeherderArtifactCollection

    tac = TreeherderArtifactCollection()

    for artifact in artifact_data:
        ta = tac.get_artifact(artifact)

        # Add any additional data to ta.data here

        # add artifact to collection
        tac.add(ta)

    req = TreeherderRequest(
        protocol='https',
        host='treeherder.mozilla.org',
        project='project',
        oauth_key='oauth-key',
        oauth_secret='oauth-secret',
        )

    # Post the request to treeherder
    req.send(tac)
```



Development
-----------

To run the `treeherder-client` test suite, run `python setup.py test`.

If you have `python2.5`, `python2.6`, or `python2.7` available on your system
under those names, you can also `pip install tox` and then run `tox` to test
`treeherder-client` under all of those Python versions.
