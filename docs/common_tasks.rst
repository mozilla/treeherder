Common tasks
============

This is a list of maintenance tasks you may have to execute on a treeherder-service deployment

Apply a change in the code
--------------------------

If you changed something in the log parser, you need to do a compilation step:

.. code-block:: bash

   > python setup.py build_ext --inplace

In order to make the various services aware of a change in the code you need to restart supervisor:

.. code-block:: bash

   > sudo /etc/init.d/supervisord restart

Add a new repository
--------------------

To add a new repository, the following steps are needed:

* Append a new datasource to the datasource fixtures file located at treeherder/model/fixtures/repository.json
* Load the file you edited with the loaddata command:

  .. code-block:: bash

     > python manage.py loaddata repository

* Create a new datasource for the given repository:

  .. code-block:: bash

     > python manage.py init_datasources

* Restart memcached to clean any previously cached datasource

  .. code-block:: bash

     > sudo /etc/init.d/memcached restart

* Generate a new oauth credentials file:

  .. code-block:: bash

     > python manage.py export_project_credentials

* Restart all the services through supervisord:

  .. code-block:: bash

     > sudo /etc/init.d/supervisord restart


Restarting varnish
------------------

You may want to restart varnish after a change in the ui. To do so type

  .. code-block:: bash

     > sudo /etc/init.d/varnish restart