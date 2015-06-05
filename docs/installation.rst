Installation
================

Cloning the Repo
----------------

* Clone the `treeherder repo`_ from Github.

Setting up Vagrant
------------------

* Install Virtualbox_ and Vagrant_ if not present.

* Open a shell, cd into the root of the project you just cloned and type

  .. code-block:: bash

     >vagrant up

  **Troubleshooting**: The Vagrant provisioning process during ``vagrant up`` assumes the presence of a stable internet connection. In the event of a connection interruption during provision, you may see errors similar to *"Temporary failure resolving.."* or *"E: Unable to fetch some archives.."* after the process has completed. In that situation, you can attempt to re-provision using the command:

  .. code-block:: bash

     >vagrant provision

  If that is still unsuccessful, you should attempt a ``vagrant destroy`` followed by another ``vagrant up``.

  **Troubleshooting**: If you encounter an error saying *"It appears your machine doesn't support NFS, or there is not an adapter to enable NFS on this machine for Vagrant."*, then you need to install ``nfs-kernel-server`` using the command:

  .. code-block:: bash

    apt-get install nfs-kernel-server

  **Troubleshooting**: If you encounter an error saying *"mount.nfs: requested NFS version or transport protocol is not supported"*, you should restart the kernel server service using this sequence of commands:

  .. code-block:: bash

    systemctl stop nfs-kernel-server.service
    systemctl disable nfs-kernel-server.service
    systemctl enable nfs-kernel-server.service
    systemctl start nfs-kernel-server.service

  **Troubleshooting**: If you encounter an error saying *"The guest machine entered an invalid state while waiting for it to boot. Valid states are 'starting, running'. The machine is in the 'poweroff' state. Please verify everything is configured properly and try again."* you should should check your host machine's virtualization technology (vt-x) is enabled in the BIOS (see this guide_), then continue with ``vagrant up``.

  .. _guide: http://www.sysprobs.com/disable-enable-virtualization-technology-bios

  For the full list of available Vagrant commands, please see their command line documentation_.

  .. _documentation: http://docs.vagrantup.com/v2/cli/

* It will typically take 5 to 30 minutes for the vagrant up to complete, depending on your network performance.

* Once the virtual machine is set up, log into it with

  .. code-block:: bash

     >vagrant ssh

  A python virtual environment will be activated on login, and the working directory will be the treeherder source directory shared from the host machine.

* If you just wish to :ref:`run the tests <running-tests>`, you can stop now without performing the remaining steps below.

Setting up a local Treeherder instance
--------------------------------------

* And this line to your **host** machine's /etc/hosts so that you can point your browser to local.treeherder.mozilla.org to reach the VM

  .. code-block:: bash

     # Copy this line verbatim (do not adjust the IP)
     192.168.33.10    local.treeherder.mozilla.org

Viewing the local server
------------------------

* Start a gunicorn instance, to serve API requests:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ ./bin/run_gunicorn

* Or for development you can use the django runserver instead of gunicorn:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ ./manage.py runserver

  this is more convenient because it automatically refreshes every time there's a change in the code. However it can consume too much memory when under load (eg due to data ingestion), causing the OS to kill it.

* Visit http://local.treeherder.mozilla.org in your browser. Note: There will be no data to display until the ingestion tasks are run.

Running the ingestion tasks
---------------------------

Ingestion tasks populate the database with version control push logs, queued/running/completed buildbot jobs & output from log parsing, as well as maintain a list of job etas and cache of intermittent failure bugs. To run these:

* Ensure the django runserver or gunicorn instance is running first (see "Viewing the local server" above).

* In another Vagrant SSH session, start up a celery worker to process async tasks:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ celery -A treeherder worker -B --concurrency 5

  The "-B" option tells the celery worker to startup a beat service, so that periodic tasks can be executed.
  You only need one worker with the beat service enabled. Multiple beat services will result in periodic tasks being executed multiple times.

Ingesting a single push (at a time)
-----------------------------------

Alternatively, instead of running a full ingestion task, you can process just
the jobs associated with any single push generated in the last 4 hours
(builds-4h_), in a synchronous manner. This is ideal for testing.

  .. _builds-4h: http://builddata.pub.build.mozilla.org/buildjson/

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ ./manage.py ingest_push mozilla-central 63f8a47cfdf5

You can further restrict the amount of data to a specific type of job
with the "--filter-job-group" parameter. For example, to process only
talos jobs for a particular push, try:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ ./manage.py ingest_push --filter-job-group T mozilla-central 63f8a47cfdf

Note that some types of data (e.g. performance) are not processed immediately, and you
will thus need to start a celery worker to handle them. You don't need
to enable the beat service for this though, so you can omit the "-B":

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ celery -A treeherder worker

.. _treeherder repo: https://github.com/mozilla/treeherder
.. _Vagrant: https://www.vagrantup.com
.. _Virtualbox: https://www.virtualbox.org
