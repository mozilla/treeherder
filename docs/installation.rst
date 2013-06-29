Installation
================

* Clone the `project repo`_ on Github

* Install Virtualbox_ and Vagrant_ if not present.

* Open a shell, cd into the root of the project you just cloned and type

  .. code-block:: bash
     
     >vagrant up

* Go grab a tea or coffee, it will take a few minutes to setup the environment.

* Once the virtual machine is set up, you can log into it with
  
  .. code-block:: bash
     
     >vagrant ssh

* Activate the python virtual environment and cd into the project directory:

  .. code-block:: bash
     
     vagrant@precise32:~$ source venv/bin/activate
     (venv)vagrant@precise32:~$ cd treeherder

* You can run the py.test suite with
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ ./runtests.sh

* Init a master database:
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ python manage.py init_master_db

* Start a gunicorn instance listening on port 8000
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ gunicorn treeherder.webapp.wsgi:application

  all the request sent to your virtual machine (ip 192.168.33.10 by default) on port 80 will be proxied to port 8000 by apache.

* For development you can use the django runserver instead of gunicorn:
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ python manage.py runserver

  this is more convenient because it automatically refreshes every time there's a change in the code.

.. _project repo: https://github.com/mozilla/treeherder-service
.. _Vagrant: http://downloads.vagrantup.com
.. _Virtualbox: https://www.virtualbox.org
