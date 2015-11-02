Setup for Remote Debugging
==========================

for IntelliJ IDEA 13.1.6, Ultimate Edition on Windows

Before Starting
---------------

-  It is assumed you have Treeherder setup in a VM already
   [instructions] (installation\_for\_windows.rst) and can run both

   -  ``./manage.py runserver``
   -  ``celery -A treeherder worker -B --concurrency 5``

-  These instructions ***may*** also work with the paid version of
   PyCharm (a derivative product from same company, with much better
   online docs concerning remote debugging)
-  ***All Windows paths will use forward slashes, and tilde (``~``) will
   be used to represent the directory you put ``treeherder`` in.*** For
   me, ``~`` represents ``C:\\Users\\kyle\\code``. For example,
   ``~/treeherder`` is at ``C:\\Users\\kyle\\code\\treeherder``.

Copy Virtual Environment Files
------------------------------

The Treeherder VM has a Python virtual environment which holds all the
libraries' source code. Remote debugging requires these source files so
it has something to show you when stepping through the code. If you do
not plan to step through the library source code, you do not need to
copy them locally.

I use `WinSCP <http://winscp.net/eng/index.php>`__ to copy the files
(using SCP)

-  from remote ``/home/vagrant/venv``
-  to ``~/treeherder_venv``

Add a new SDK
-------------

Remote debugging uses *just-another-interpreter*, like CPython or PyPy.
In this case, the SKD will login to the VM, and inject the server-side
code required to interact with the IDE client.

Go to *Files -> Project structure -> Platform Settings -> SDKs* and add
a Python Remote SDK with the following settings.

-  **host** - 127.0.0.1
-  **port** - 2222
-  **username** - vagrant
-  **auth type** - keypair
-  **private key file** -
   ~/treeherder/.vagrant/machines/default/virtualbox/private\_key
-  **Python interpreter path** - /home/vagrant/venv/bin/python

Make new Run/Debug configuration using the new SDK
--------------------------------------------------

We setup a configuration to run ``.\manage.py runserver``; just like the
setup instructions, plus allow us to set breakpoints in the code
interactively as it runs.

-  **Script** - ``.\manage.py``
-  **Script parameters** - ``runserver``
-  **Environment variables** -

   -  

      .. raw:: html

         <pre>TREEHERDER\_DJANGO\_SECRET\_KEY = secretkey-1234
         DATABASE\_URL = mysql://treeherder\_user:treeherder_pass@localhost/treeherder
         DATABASE\_URL\_RO = mysql://treeherder\_user:treeherder\_pass@localhost/treeherder
         TREEHERDER\_DEBUG = 1
         PYTHONPATH = /home/vagrant/venv/lib/python2.7/site-packages/:.</pre>

-  **Working directory** - ``~\treeherder``
-  **Path mappings** -

   -  

      .. raw:: html

         <pre>local = ~/treeherder        remote = /home/vagrant/treeherder
         local = ~/treeherder_venv   remote = /home/vagrant/venv</pre>

Connecting to the Database
--------------------------

Be sure to open port 3306 on VirtualBox so you can connect directly to
the Treeherder database. Since you probably have MySQL installed on your
Windows machine already, be sure to map it to a free port (like 3307).

Connection info is in the [vagrant config file]
(https://github.com/mozilla/treeherder/blob/8ae90719017f51a96f1ac0ffba9f481116fd7a44/puppet/manifests/vagrant.pp#L14),
but can also be seen in the environment variables above.

-  ``username = treeherder_user``
-  ``password = treeherder_pass``

Some Starting Points
--------------------

Treeherder is a Django application. It is best understood by reviewing
its URL dispatch/routing code:

-  Start here and trace the logic to the other ``urls.py`` files:
   `treeherder/config/urls.py <https://github.com/mozilla/treeherder/blob/master/treeherder/config/urls.py>`__
-  For example, the web API endpoint definitions:
   `treeherder/webapp/api/urls.py <https://github.com/mozilla/treeherder/blob/master/treeherder/webapp/api/urls.py>`__
