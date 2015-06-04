Troubleshooting
===============

My log parsing isn't working
----------------------------

If you encounter job log parsing not working in general, or when selecting a job, you should ``ctrl-c`` to do a warm shutdown of your celery process then:

.. code-block:: bash

    (venv)vagrant@local:~/treeherder$ rm celerybeat-schedule

And then restart your celery worker as normal via:

.. code-block:: bash

    (venv)vagrant@local:~/treeherder$ celery -A treeherder worker -B

Can I use supervisord instead for my services?
----------------------------------------------

Yes, you can install supervisord in your environment with:

.. code-block:: bash

   (venv)vagrant@local:~/treeherder$ pip install supervisor

And then start the treeherder services in individual shells:

.. code-block:: bash

   (venv)vagrant@local:~/treeherder$ sudo /home/vagrant/venv/bin/supervisord -c deployment/supervisord/admin_node.conf

   (venv)vagrant@local:~/treeherder$ sudo /home/vagrant/venv/bin/supervisord -c deployment/supervisord/etl_node.conf

   (venv)vagrant@local:~/treeherder$ sudo /home/vagrant/venv/bin/supervisord -c deployment/supervisord/worker_node.conf

Each config file contains a section for each service that you may want to run. Feel free to comment one or more of those sections if you don't need that specific service. If you just want to access the restful api or the admin for example, comment all those sections but the one related to gunicorn. You can stop supervisord and all processes it takes care of with ``ctrl+c``. Please note you may need to manually kill the celery worker when it's under heavy load.

Where are my log files?
-----------------------

You can find the various service log files under:

.. code-block:: bash

  (venv)vagrant@local:/var/log/celery/

  (venv)vagrant@local:/var/log/gunicorn/

You may also want to inspect the main treeherder log file in:

.. code-block:: bash

  (venv)vagrant@local:~/treeherder/treeherder/
