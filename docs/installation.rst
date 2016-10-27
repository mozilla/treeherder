Installation
================

.. note:: This section describes how to set up a fully functioning
          instance of Treeherder. If you only want to hack on the UI,
          you can just setup a standalone webserver which accesses
          the server backend using node.js, which is much simpler.
          See the :doc:`UI installation section <ui/installation>`.


Prerequisites
-------------

* If you are new to Mozilla or the A-Team, read the `A-Team Bootcamp`_.
* Install Git_, Virtualbox_ and Vagrant_ (latest versions recommended).
* Clone the `treeherder repo`_ from Github.
* Windows only: Ensure MSYS ssh (ships with Git for Windows) is on the PATH, so Vagrant can find it (using PuTTY is more hassle).
* Linux only: An nfsd server is required. You can install this on Ubuntu by running `apt-get install nfs-common nfs-kernel-server`

Setting up Vagrant
------------------

* Open a shell, cd into the root of the Treeherder repository, and type:

  .. code-block:: bash

     > vagrant up

  It will typically take 5 to 30 minutes for the vagrant up to
  complete, depending on your network performance. If you experience
  any errors, see the :ref:`troubleshooting page
  <troubleshooting-vagrant>`. It is *very important* that the
  provisioning process complete successfully before trying to interact
  with your test instance of treeherder: some things might
  superficially seem to work a partially configured machine, but
  it is almost guranteed that some things *will break* in
  hard-to-diagnose ways if vagrant provision is not run to completion.

* While the previous command is running, use the time to add this line to your **host** machine's /etc/hosts:

  .. code-block:: bash

     # Copy this line verbatim (do not adjust the IP)
     192.168.33.10    local.treeherder.mozilla.org

* Once the virtual machine is set up, connect to it using:

  .. code-block:: bash

     > vagrant ssh

  A python virtual environment will be activated on login, and the working directory will be the treeherder source directory shared from the host machine.

* For the full list of available Vagrant commands (for example, suspending the VM when you are finished for the day), see their `command line documentation`_.

  .. _`command line documentation`: http://docs.vagrantup.com/v2/cli/

* If you just wish to :ref:`run the tests <running-tests>`, you can stop now without performing the remaining steps.

Starting a local Treeherder instance
------------------------------------

* Start a gunicorn instance inside the Vagrant VM, to serve the static UI and API requests:

  .. code-block:: bash

     vagrant ~/treeherder$ ./bin/run_gunicorn

  Or for development you can use the django runserver instead of gunicorn:

  .. code-block:: bash

     vagrant ~/treeherder$ ./manage.py runserver

  this is more convenient because it automatically refreshes every time there's a change in the code.

* Visit http://local.treeherder.mozilla.org in your browser. Note: There will be no data to display until the ingestion tasks are run.

Running the ingestion tasks
---------------------------

Ingestion tasks populate the database with version control push logs, queued/running/completed buildbot jobs & output from log parsing, as well as maintain a list of job etas and cache of intermittent failure bugs. To run these:

* Start up a celery worker to process async tasks:

  .. code-block:: bash

     vagrant ~/treeherder$ celery -A treeherder worker -B --concurrency 5

  The "-B" option tells the celery worker to startup a beat service, so that periodic tasks can be executed.
  You only need one worker with the beat service enabled. Multiple beat services will result in periodic tasks being executed multiple times.

Ingesting a current push in builds-4h
-------------------------------------

Alternatively, instead of running a full ingestion task, you can process just
the jobs associated with any single push generated in the last 4 hours
(builds-4h_), in a synchronous manner. This is ideal for testing. For example:

  .. _builds-4h: http://builddata.pub.build.mozilla.org/buildjson/

  .. code-block:: bash

     vagrant ~/treeherder$ ./manage.py ingest_push mozilla-inbound 63f8a47cfdf5

If running this locally, replace `63f8a47cfdf5` with a recent revision (= pushed within
the last four hours) on mozilla-inbound.

You can further restrict the amount of data to a specific type of job
with the "--filter-job-group" parameter. For example, to process only
talos jobs for a particular push, try:

  .. code-block:: bash

     vagrant ~/treeherder$ ./manage.py ingest_push --filter-job-group T mozilla-inbound 63f8a47cfdf

Ingesting a push from a past builds-4h
--------------------------------------

If you need to ingest a specific push that is more than 4 hours old, or for example
in a repo which does not experience frequent hourly pushes, you can use this workflow:

* Find the older resultset on production you'd like to ingest and note its date/time

* Find the corresponding date/time window .gz in builds-4h_

* Download, extract, and open the .gz and confirm the presence of the matching 'got_revision' SHA

* Optional: thpurge, re-provision your vagrant to be certain you're ingesting anew

  .. code-block:: bash

     vagrant ~/treeherder$ thpurge

* Switch treeherder/config/settings.py BUILDAPI_BUILDS4H_URL to your custom value, for example:

  .. code-block:: bash

     BUILDAPI_BUILDS4H_URL = "http://builddata.pub.build.mozilla.org/buildjson/builds-2016-08-28.js.gz"

* Ingest the push, as an example for the URL above:

  .. code-block:: bash

     vagrant ~/treeherder$ ./manage.py ingest_push comm-central 2540c39cc958


.. _A-Team Bootcamp: https://ateam-bootcamp.readthedocs.io
.. _Git: https://git-scm.com
.. _Vagrant: https://www.vagrantup.com
.. _Virtualbox: https://www.virtualbox.org
.. _treeherder repo: https://github.com/mozilla/treeherder
