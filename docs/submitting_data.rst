Submitting Data
===============

To submit your test data to Treeherder, you have two options:

1. :ref:`Submitting using Pulse <submitting-using-pulse>`

    This is the new process Task Cluster is using to submit data to Treeherder.
    There is a JSON Schema to validate your payload against to ensure it will
    be accepted.  In this case, you create a Pulse exchange and publish to it.
    To get your data into treeherder, you would create a bug to have your
    exchange added to Treeherder's Pulse config.  All Treeherder instances can
    subscribe to get your data, as can local dev instances for testing.

2. :ref:`Submitting using the Python client <submitting-using-python-client>`

    This is historically how projects and users have submitted data to Treeherder.
    This requires getting Hawk credentials approved by a Treeherder Admin.
    There is a client library to help make this easier.  However, there is no
    schema to validate the payload against.  But using the client to build your
    payload will help you get it in the accepted form.  Your data only goes to
    the host you send it to.  Dev instances can not subscribe to this data.


.. _submitting-using-pulse:

Submitting using Pulse
======================

To submit via a Pulse exchange, these are the steps you will need to follow:

1. Create your Exchange
-----------------------

With `Pulse Guardian`_, you can create your Pulse User in order to access and
create your own Queues and Exchanges.  There is no mechanism to create an
Exchange in the Pulse Guardian UI itself, however.  You will need to create
your exchange in your submitting code.  There are a few options available
for that:

1. `MozillaPulse`_
2. `Kombu`_
4. Or any RabbitMQ package of your choice

2. Format your data
-------------------

The new job format in `YML Schema`_ is significantly different from the one
used in our API job submission.  It has virtually the same data, just in
(what we hope) is a better form.  You are responsible for validating your data
prior to publishing it onto your Exchange, or Treeherder may reject it.

3. Register with Treeherder
---------------------------

Treeherder has to know about your exchange and which routing keys to use in
order to load your jobs.

Submit a `Treeherder bug`_ with the following information::

    {
        "exchange": "exchange/my-pulse-user/v1/jobs",
        "destinations": [
            'treeherder'
        ],
        "projects": [
            'mozilla-inbound._'
        ],
    },

Treeherder will bind to the exchange looking for all combinations of routing
keys from ``destinations`` and ``projects`` listed above.  For example with
the above config, we will only load jobs with routing keys of
``treeherder.mozilla-inbound._``

If you want all jobs from your exchange to be loaded, you could simplify the
config by having values::

        "destinations": [
            '#'
        ],
        "projects": [
            '#'
        ],

If you want one config to go to Treeherder Staging and a different one to go
to Production, please specify that in the bug.  You could use the same exchange
with different routing key settings, or two separate exchanges.  The choice is
yours.

4. Publish jobs to your Exchange
--------------------------------

Once the above config is set on Treeherder, you can begin publishing jobs
to your Exchange and they will start showing in Treeherder.

You will no longer need any special credentials.  You publish messages to the
Exchange YOU own.  Treeherder is now just listening to it.


.. _submitting-using-python-client:

Submitting using the Python Client
==================================

There are two types of data structures you can submit with the :ref:`Python client
<python-client>`: job and resultset collections. The client provides methods
for building a data structure that treeherder will accept. Data
structures can be extended with new properties as needed, there is a
minimal validation protocol applied that confirms the bare minimum
parts of the structures are defined.

See the :ref:`Python client <python-client>` section for how to control
which Treeherder instance will be accessed by the client.

Authentication is covered :ref:`here <authentication>`.


Resultset Collections
---------------------

Resultset collections contain meta data associated with a github pull request
or a push to mercurial or any event that requires tests to be run on a
repository.  The most critical part of each resultset is the `revision`.
This is used as an identifier to associate test job data with. This is the
commit SHA of the top commit for the push.  It should be 40 characters, but
can be a 12 character revision in some cases.  A resultset collection has the
following data structure:

.. code-block:: python

    [
        {
            # The top-most revision in the list of commits for a push.
            'revision': '45f8637cb9f78f19cb8463ff174e81756805d8cf',
            'author': 'somebody@somewhere.com',
            'push_timestamp': 1384353511,
            'type': 'push',
            # a list of revisions associated with the resultset. There should be at least
            # one.
            'revisions': [
                {
                    'comment': 'Bug 936711 - Fix crash which happened at disabling Bluetooth...',
                    'revision': 'cdfe03e77e66',
                    'repository': 'test_treeherder',
                    'author': 'Some Person <sperson@someplace.com>'
                },
                ...
            ]
        }
    ]


Job Collections
---------------

Job collections can contain test results from any kind of test. The
`revision` provided should match the associated `revision` in the
resultset structure. The `revision` is the top-most revision in the push.
The `job_guid` provided can be any unique string of 50
characters at most. A job collection has the following data structure.

.. code-block:: python

    [
        {
            'project': 'mozilla-inbound',

            'revision': '4317d9e5759d58852485a7a808095a44bc806e19',

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

                'option_collection': {'opt': True},

                # jobs can belong to different tiers
                # setting the tier here will determine which tier the job
                # belongs to.  However, if a job is set as Tier of 1, but
                # belongs to the Tier 2 profile on the server, it will still
                # be saved as Tier 2.
                'tier': 2,

                # the ``name`` of the log can be the default of "buildbot_text"
                # however, you can use a custom name.  See below.
                'log_references': [
                    {
                        'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                        'name': 'buildbot_text'
                        }
                    ],

                # The artifact can contain any kind of structured data associated with a test.
                'artifacts': [{
                    'type': 'json',
                    'name': '',
                    'blob': { my json content here}
                }],

                # List of job guids that were coalesced to this job
                'coalesced': []
            },
            ...
    ]

see :ref:`custom-log-name` for more info.


Artifact Collections
--------------------

Artifact collections contain arbitrary data associated with a job. This is
usually a json blob of structured data produced by the build system during the
job execution.

.. code-block:: python

    [
        {
            'type': 'json',
            'name': 'my-artifact-name',
            # blob can be any kind of structured data
            'blob': { 'stuff': [1, 2, 3, 4, 5] },
            'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
        }
    ]

Usage
-----

If you want to use `TreeherderResultSetCollection` to build up the resultset
data structures to send, do something like this.

.. code-block:: python

    from thclient import (TreeherderClient, TreeherderClientError,
                          TreeherderResultSetCollection)


    trsc = TreeherderResultSetCollection()

    for data in dataset:

        trs = trsc.get_resultset()

        trs.add_push_timestamp( data['push_timestamp'] )
        trs.add_revision( data['revision'] )
        trs.add_type( data['type'] )
        trs.add_artifact( 'push_data', 'push', { 'stuff':[1,2,3,4,5] } )

        for revision in data['revisions']:

            tr = trs.get_revision()

            tr.add_revision( revision['revision'] )
            tr.add_author( revision['author'] )
            tr.add_comment( revision['comment'] )
            tr.add_repository( revision['repository'] )

            trs.add_revision(tr)

        trsc.add(trs)

    # Send the collection to treeherder

    # See the authentication section below for details on how to get a
    # hawk id and secret
    client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')

    # Post the result collection to a project
    #
    # data structure validation is automatically performed here, if validation
    # fails a TreeherderClientError is raised
    client.post_collection('mozilla-central', trsc)

At any time in building a data structure, you can examine what has been
created by looking at the `data` property.  You can also call the `validate`
method at any time before sending a collection.  All treeherder data classes
have `validate` methods that can be used for testing.  The `validate` method
is called on every structure in a collection when `post_collection` is
called. If validation fails a `TreeherderClientError` is raised.

If you want to use `TreeherderJobCollection` to build up the job data
structures to send, do something like this:

.. code-block:: python

    from thclient import (TreeherderClient, TreeherderClientError,
                          TreeherderJobCollection)

    tjc = TreeherderJobCollection()

    for data in dataset:

        tj = tjc.get_job()

        tj.add_revision( data['revision'] )
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
        tj.add_tier( 1 )
        tj.add_submit_timestamp( data['submit_timestamp'] )
        tj.add_start_timestamp( data['start_timestamp'] )
        tj.add_end_timestamp( data['end_timestamp'] )
        tj.add_machine( data['machine'] )

        tj.add_build_info(
            data['build']['os_name'], data['build']['platform'], data['build']['architecture']
            )

        tj.add_machine_info(
            data['machine']['os_name'], data['machine']['platform'], data['machine']['architecture']
            )

        tj.add_option_collection( data['option_collection'] )

        tj.add_log_reference( 'buildbot_text', data['log_reference'] )

        # data['artifact'] is a list of artifacts
        for artifact_data in data['artifact']:
            tj.add_artifact(
                artifact_data['name'], artifact_data['type'], artifact_data['blob']
                )
        tjc.add(tj)

    client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')
    client.post_collection('mozilla-central', tjc)

If you want to use `TreeherderArtifactCollection` to build up the job
artifacts data structures to send, do something like this:

.. code-block:: python

    from thclient import (TreeherderClient, TreeherderClientError,
                          TreeherderArtifactCollection)

    tac = TreeherderArtifactCollection()

    for data in dataset:

        ta = tac.get_artifact()

        ta.add_blob( data['blob'] )
        ta.add_name( data['name'] )
        ta.add_type( data['type'] )
        ta.add_job_guid( data['job_guid'] )

        tac.add(ta)

    # Send the collection to treeherder
    client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')
    client.post_collection('mozilla-central', tac)

If you don't want to use `TreeherderResultCollection` or
`TreeherderJobCollection` to build up the data structure to send, build the
data structures directly and add them to the collection.

.. code-block:: python

    from thclient import TreeherderClient, TreeherderResultSetCollection

    trc = TreeherderResultSetCollection()

    for resultset in resultset_data:
        trs = trc.get_resultset(resultset)

        # Add any additional data to trs.data here

        # add resultset to collection
        trc.add(trs)

    client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')
    client.post_collection('mozilla-central', trc)

.. code-block:: python

    from thclient import TreeherderClient, TreeherderJobCollection

    tjc = TreeherderJobCollection()

    for job in job_data:
        tj = tjc.get_job(job)

        # Add any additional data to tj.data here

        # add job to collection
        tjc.add(tj)

    client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')
    client.post_collection('mozilla-central', tjc)

In the same way, if you don't want to use `TreeherderArtifactCollection` to
build up the data structure to send, build the data structures directly and
add them to the collection.

.. code-block:: python

    from thclient import TreeherderClient, TreeherderArtifactCollection

    tac = TreeherderArtifactCollection()

    for artifact in artifact_data:
        ta = tac.get_artifact(artifact)

        # Add any additional data to ta.data here

        # add artifact to collection
        tac.add(ta)

    client = TreeherderClient(client_id='hawk_id', secret='hawk_secret')
    client.post_collection('mozilla-central', tac)

Job artifacts format
--------------------

Artifacts can have name, type and blob. The blob property can contain any
valid data structure accordingly to type attribute.  For example if you use
the json type, your blob must be json-serializable to be valid.  The name
attribute can be any arbitrary string identifying the artifact.  Here is an
example of what a job artifact looks like in the context of a job object:

.. code-block:: python

    [
        {
            'project': 'mozilla-inbound',
            'revision_hash': '4317d9e5759d58852485a7a808095a44bc806e19',
            'job': {
                'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33',
                # ...
                # other job properties here
                # ...

                'artifacts': [
                {
                    "type": "json",
                    "name": "my first artifact",
                    'blob': {
                        k1: v1,
                        k2: v2,
                        ...
                    }
                },
                {
                    'type': 'json',
                    'name': 'my second artifact',
                    'blob': {
                        k1: v1,
                        k2: v2,
                        ...
                    }
                }
                ]
            }
        },
        ...
    ]

A special case of job artifact is a "Job Info" artifact. This kind of artifact
will be retrieved by the UI and rendered in the job detail panel. This
is what a Job Info artifact looks like:

.. code-block:: python

  {

    "blob": {
        "job_details": [
            {
                "url": "https://www.mozilla.org",
                "value": "website",
                "content_type": "link",
                "title": "Mozilla home page"
            },
            {
                "value": "bar",
                "content_type": "text",
                "title": "Foo"
            },
            {
                "value": "This is <strong>cool</strong>",
                "content_type": "raw_html",
                "title": "Cool title"
            }
        ],
    },
    "type": "json",
    "name": "Job Info"
  }

All the elements in the job_details attribute of this artifact have a
mandatory title attribute and a set of optional attributes depending on
`content_type`.  The `content_type` drives the way this kind of artifact
will be rendered. Here are the possible values:

* **Text** - This is the simplest content type you can render and is the one
  used by default if the content type specified is not recognised or is missing.

    This content type renders as:

    .. code-block:: html

      <label>{{title}}</label><span>{{value}}</span>

* **Link** - This content type renders as an anchor html tag with the
  following format:

    .. code-block:: html

      {{title}}: <a title="{{value}}" href="{{url}}" target="_blank">{{value}}</a>

* **Raw Html** - The last resource for when you need to show some formatted
  content.



Some Specific Collection POSTing Rules
--------------------------------------

Treeherder will detect what data is submitted in the ``TreeherderCollection``
and generate the necessary artifacts accordingly.  The outline below describes
what artifacts *Treeherder* will generate depending on what has been submitted.

See :ref:`schema_validation` for more info on validating some specialized JSON
data.

JobCollections
^^^^^^^^^^^^^^
Via the ``/jobs`` endpoint:

1. Submit a Log URL with no ``parse_status`` or ``parse_status`` set to "pending"
    * This will generate ``text_log_summary`` and ``Bug suggestions`` artifacts
    * Current *Buildbot* workflow

2. Submit a Log URL with ``parse_status`` set to "parsed" and a ``text_log_summary`` artifact
    * Will generate a ``Bug suggestions`` artifact only
    * Desired future state of *Task Cluster*

3. Submit a Log URL with ``parse_status`` of "parsed", with ``text_log_summary`` and ``Bug suggestions`` artifacts
    * Will generate nothing


ArtifactCollections
^^^^^^^^^^^^^^^^^^^
Via the ``/artifact`` endpoint:

1. Submit a ``text_log_summary`` artifact
    * Will generate a ``Bug suggestions`` artifact if it does not already exist for that job.

2. Submit ``text_log_summary`` and ``Bug suggestions`` artifacts
    * Will generate nothing
    * This is *Treeherder's* current internal log parser workflow


.. _custom-log-name:

Specifying Custom Log Names
---------------------------

By default, the Log Viewer expects logs to have the name of ``buildbot_text``
at this time.  However, if you are supplying the ``text_log_summary`` artifact
yourself (rather than having it generated for you) you can specify a custom
log name.  You must specify the name in two places for this to work.

1. When you add the log reference to the job:

.. code-block:: python

    tj.add_log_reference( 'my_custom_log', data['log_reference'] )


2. In the ``text_log_summary`` artifact blob, specify the ``logname`` param.
   This artifact is what the Log Viewer uses to find the associated log lines
   for viewing.

.. code-block:: python

    {
        "blob":{
            "step_data": {
                "all_errors": [ ],
                "steps": [
                    {
                        "errors": [ ],
                        "name": "step",
                        "started_linenumber": 1,
                        "finished_linenumber": 1,
                        "finished": "2015-07-08 06:13:46",
                        "result": "success",
                        "duration": 2671,
                        "order": 0,
                        "error_count": 0
                    }
                ],
                "errors_truncated": false
            },
            "logurl": "https://example.com/mylog.log",
            "logname": "my_custom_log"
        },
        "type": "json",
        "id": 10577808,
        "name": "text_log_summary",
        "job_id": 1774360
    }

.. _Pulse Guardian: https://pulse.mozilla.org/whats_pulse
.. _Pulse Inspector: https://tools.taskcluster.net/pulse-inspector/
.. _YML Schema: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
.. _Treeherder bug: https://bugzilla.mozilla.org/enter_bug.cgi?component=Treeherder:%20Data%20Ingestion&form_name=enter_bug&op_sys=All&product=Tree%20Management&rep_platform=All
.. _MozillaPulse: https://pypi.python.org/pypi/MozillaPulse
.. _Kombu: https://pypi.python.org/pypi/kombu

