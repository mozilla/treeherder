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

.. _running-tests:

Running the tests
-----------------

* You can run the py.test suite with

  .. code-block:: bash

     (venv)vagrant@precise32:~/treeherder-service$ ./runtests.sh

* Or for more control, run py.test directly

  .. code-block:: bash

     (venv)vagrant@precise32:~/treeherder-service$ py.test tests/
     (venv)vagrant@precise32:~/treeherder-service$ py.test tests/log_parser/test_utils.py
     (venv)vagrant@precise32:~/treeherder-service$ py.test tests/etl/test_buildapi.py -k test_ingest_builds4h_jobs

* To run all tests, including slow tests that are normally skipped, use

  .. code-block:: bash

     (venv)vagrant@precise32:~/treeherder-service$ py.test --runslow tests/

* For more options, see ``py.test --help`` or http://pytest.org/latest/usage.html

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

Executing arbitrary SQL
-----------------------

As part of a larger change, you may want to execute some arbitrary SQL
on the server. You can do this with the `run_sql` management command.

Example:

  .. code-block:: bash

     > ./manage.py run_sql -f <sqlfile>

By default, this will run the sql against the `jobs` database for each
project. If you want to run against the object store or only against a
specific datasource, you can do that with that `--datasources` and
`--data-type` options. Run `./manage.py run_sql --help` for more
details.

