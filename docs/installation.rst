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

* A python virtual environment will be activated on login, all that is left to do is cd into the project directory:

  .. code-block:: bash
     
     (venv)vagrant@precise32:~$ cd treeherder-service

* You can run the py.test suite with
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ ./runtests.sh

* Init a master database and setup datasources:
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ python manage.py init_master_db
     (venv)vagrant@precise32:~/treeherder-service$ python manage.py init_datasources

* Add an entry to your vm /etc/hosts for your treeherder virtual host:

  .. code-block:: bash

     127.0.0.1    local.treeherder.mozilla.org

* And one to your host machine /etc/hosts so that you can point your browser to local.treeherder.mozilla.org to reach it

  .. code-block:: bash

     192.168.33.10    local.treeherder.mozilla.org

* Start a gunicorn instance listening on port 8000
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ gunicorn treeherder.webapp.wsgi:application

  all the request sent to local.treeherder.mozilla.org will be proxied to it by apache.

* Start up one or more celery worker to process async tasks:

  .. code-block:: bash

     (venv)vagrant@precise32:~/treeherder-service$ python manage.py celery worker -B

  The "-B" option tells the celery worker to startup a beat service, so that periodic tasks can be executed.
  You only need one worker with the beat service enabled. Multiple beat services will result in periodic tasks being executed multiple times

* For development you can use the django runserver instead of gunicorn:
  
  .. code-block:: bash
     
     (venv)vagrant@precise32:~/treeherder-service$ python manage.py runserver

  this is more convenient because it automatically refreshes every time there's a change in the code.

* The log parser shipped with treeherder makes use of cython. If you change something in the treeherder/log_parser folder, remember to re-build the c extensions with:

  .. code-block:: bash

     (venv)vagrant@precise32:~/treeherder-service$ python setup.py build_ext --inplace


.. _project repo: https://github.com/mozilla/treeherder-service
.. _Vagrant: http://downloads.vagrantup.com
.. _Virtualbox: https://www.virtualbox.org
