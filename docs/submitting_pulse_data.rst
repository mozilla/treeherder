.. _submitting_to_pulse:

Submitting Pulse Data
=====================

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
3. `librabbitmq`_
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



.. _Pulse Guardian: https://pulse.mozilla.org/whats_pulse
.. _Pulse Inspector: https://tools.taskcluster.net/pulse-inspector/
.. _YML Schema: https://github.com/mozilla/treeherder/blob/master/schemas/pulse-job.yml
.. _Treeherder bug: https://bugzilla.mozilla.org/enter_bug.cgi?component=Treeherder:%20Data%20Ingestion&form_name=enter_bug&op_sys=All&product=Tree%20Management&rep_platform=All
.. _MozillaPulse: https://pypi.python.org/pypi/MozillaPulse
.. _Kombu: https://pypi.python.org/pypi/kombu
.. _librabbitmq: https://pypi.python.org/pypi/librabbitmq
