Installation for Windows
========================

Requirements
------------

You will require a small constellation of applications:

-  `Virtualbox <https://www.virtualbox.org>`__ - a container for running
   VMs
-  `Vagrant <https://www.vagrantup.com>`__ - responsible for setting up
   a VM instance with Treeherder
-  `Putty <http://www.putty.org/>`__ - Tool for connecting to VM

Cloning the Repo
----------------

Before you clone, you must prevent git from converting LF to CRLF. The
documentation on the web is confusing, but here it is:

::

    git config core.autocrlf input

You may want to set this permanently:

::

    git config --global core.autocrlf input

Clone the `treeherder repo <https://github.com/mozilla/treeherder>`__
from Github.

::

    git clone https://github.com/mozilla/treeherder.git

The rest of this document assumes you cloned into ``~/treeherder``

Setup the VM
------------

Run ``cmd`` shell, change directory to ``~\treeherder`` and run
``vagrant up``

::

    vagrant up

This will probably fail for any number of reasons. In all cases run
``vagrant destroy`` followed by another ``vagrant up`` until everything
installs successfully.

**Pulling Updates**

Eventually, you will want to pull new updates from the repository: After
you perform a ``git pull origin``, you must update your VM with

::

    vagrant provision

Convert Private Key
-------------------

If you are familiar with Vagrant, then you know to use ``vagrant ssh``
to connect to the VM, unfortunately ssh is not installed on Windows, but
it does give you the connection information you need to use Putty to do
the same.

Here is a copy of my session.

::

    C:\Users\kyle\code\treeherder>vagrant ssh
    `ssh` executable not found in any directories in the %PATH% variable. Is an
    SSH client installed? Try installing Cygwin, MinGW or Git, all of which
    contain an SSH client. Or use your favorite SSH client with the following
    authentication information shown below:

    Host: 127.0.0.1
    Port: 2222
    Username: vagrant
    Private key: C:/Users/kyle/code/treeherder/.vagrant/machines/default/virtualbox/private_key

Use ``puttygen`` to load the ``private_key`` and then save it as a
private key file (``*.ppk``).

Setup Putty
-----------

You must use Putty to login to the virtual instance. Putty allows you to
configure and save sessions. The host and port fields are obvious, but
the other two are mysteriously deep in the optional panes:

-  *Connection->Data* - to store your username
-  *Connection->SSH->Auth* - to point to private key file

Once you have saved your session you should be able to login to the VM

A python virtual environment will be activated on login, and the working
directory will be the ``treeherder`` source directory shared from the
host machine.

**If you just wish to `run the tests <running-tests.rst>`__, you can
stop now without performing the remaining steps below.**

Setting up a local Treeherder instance
--------------------------------------

Add this line to ``C:\Windows\System32\drivers\etc\hosts`` so that you
can point your browser to local.treeherder.mozilla.org to reach the VM.

::

     # Copy this line verbatim (do not adjust the IP)
     192.168.33.10    local.treeherder.mozilla.org

Viewing the local server
------------------------

Start a gunicorn instance, to serve the static UI and API requests:

::

     (venv)vagrant@local:~/treeherder$ ./bin/run_gunicorn

Or for development you can use the django runserver instead of gunicorn:

::

     (venv)vagrant@local:~/treeherder$ python ./manage.py runserver &

this is more convenient because it automatically refreshes every time
there's a change in the code. However it can consume too much memory
when under load (eg due to data ingestion), causing the OS to kill it.

Visit http://local.treeherder.mozilla.org in your browser. Note: There
will be no data to display until the ingestion tasks are run.

Summary
-------

Once these Windows-specific tasks are completed, the rest of your
actions will be inside the Linux VM. You may resume the main
installation documentation at `Running the ingestion
tasks <http://treeherder.readthedocs.org/installation.html#running-the-ingestion-tasks>`__
