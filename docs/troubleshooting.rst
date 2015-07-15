Troubleshooting
===============

Using supervisord for development
---------------------------------

On an ubuntu machine you can install supervisord with

.. code-block:: bash

   >sudo apt-get install supervisor

To start supervisord with an arbitrary configuration, you can type:

.. code-block:: bash

   >supervisord -c my_config_file.conf

You can find a supervisord config file inside the deployment/supervisord folder.
That config file contains a section for each service that you may want to run.
Feel free to comment one or more of those sections if you don't need that specific service.
If you just want to access the restful api or the admin for example, comment all those sections but the one
related to gunicorn.
You can stop supervisord (and all processes he's taking care of) with ctrl+c.
Please note that for some reasons you may need to manually kill the celery worker, for example when it's under heavy load.

Why is my celery ingestion not running?
---------------------------------------

If after a ``celery -A treeherder worker -B --concurrency 5`` you experience a static celery console with no output, similar to:

.. code-block:: bash

   09:32:40,010: WARNING/MainProcess] celery@local ready.

You should ctrl+c to shut down celery, remove the ``celerybeat-schedule`` file in the project root, and restart your worker.

Where are my log files?
-----------------------

You can find the various services log files under
  * /var/log/celery
  * /var/log/gunicorn

You may also want to inspect the main treeherder log file ~/treeherder/treeherder.log
