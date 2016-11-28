Troubleshooting
===============

.. _troubleshooting-vagrant:

Errors during Vagrant setup
---------------------------

* The Vagrant provisioning process during ``vagrant up`` assumes the presence of a stable internet connection. In the event of a connection interruption during provision, you may see errors similar to *"Temporary failure resolving.."* or *"E: Unable to fetch some archives.."* after the process has completed. In that situation, you can attempt to re-provision using the command:

  .. code-block:: bash

     >vagrant provision

  If that is still unsuccessful, you should attempt a ``vagrant destroy`` followed by another ``vagrant up``.

* If you encounter an error saying *"mount.nfs: requested NFS version or transport protocol is not supported"*, you should restart the kernel server service using this sequence of commands:

  .. code-block:: bash

    systemctl stop nfs-kernel-server.service
    systemctl disable nfs-kernel-server.service
    systemctl enable nfs-kernel-server.service
    systemctl start nfs-kernel-server.service

* If you encounter an error saying *"The guest machine entered an invalid state while waiting for it to boot. Valid states are 'starting, running'. The machine is in the 'poweroff' state. Please verify everything is configured properly and try again."* you should should check your host machine's virtualization technology (vt-x) is enabled in the BIOS (see this guide_), then continue with ``vagrant up``.

  .. _guide: http://www.sysprobs.com/disable-enable-virtualization-technology-bios

* On Windows, if upon running ``vagrant ssh`` you see the error *"/home/vagrant/.bash_aliases: line 1: syntax error near unexpected token `$'{\r''"* - it means your global Git line endings configuration is not correct. On the host machine run:

  .. code-block:: bash

    git config --global core.autocrlf input

  You will then need to delete and reclone the repo (or else do a force checkout).

Why is my celery ingestion not running?
---------------------------------------

If after a ``celery -A treeherder worker -B --concurrency 5`` you experience a static celery console with no output, similar to:

.. code-block:: bash

   09:32:40,010: WARNING/MainProcess] celery@local ready.

You should ctrl+c to shut down celery, remove the ``celerybeat-schedule`` file in the project root, and restart your worker.
