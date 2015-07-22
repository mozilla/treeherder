Common tasks
============

This is a list of maintenance tasks you may have to execute on a treeherder deployment

Apply a change in the code
--------------------------

In order to make the various services aware of a change in the code you need to restart supervisor:

.. code-block:: bash

   > sudo /etc/init.d/supervisord restart

.. _running-tests:

Running the tests
-----------------

* You can run flake8 and the py.test suite using

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ ./runtests.sh

* Or for more control, run py.test directly

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ py.test tests/
     (venv)vagrant@local:~/treeherder$ py.test tests/log_parser/test_utils.py
     (venv)vagrant@local:~/treeherder$ py.test tests/etl/test_buildapi.py -k test_ingest_builds4h_jobs

* To run all tests, including slow tests that are normally skipped, use

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ py.test --runslow tests/

* For more options, see ``py.test --help`` or http://pytest.org/latest/usage.html

* To run flake8 on its own, use

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ flake8


Look up credentials for a project
---------------------------------

To submit data to an existing project, you need corresponding OAuth
credentials, even if you're submitting to your local server.

Prerequisite: you must have previously exported credentials for all data
source projects. This is part of the usual Treeherder setup process.

  .. code-block:: bash

      (venv)vagrant@local:~/treeherder$ ./manage.py export_project_credentials

The above command writes all project credentials to
``treeherder/etl/data/credentials.json`` for use by the Treeherder service.

If you are implementing :doc:`data submission <submitting_data>` with
``TreeherderClient`` and testing that locally, it is useful to work with your
own copy of ``credentials.json``. You can export the credentials wherever you
need with the ``--destination`` option:

  .. code-block:: bash

      (venv)vagrant@local:~/treeherder$ ./manage.py export_project_credentials --destination /some/path

Within Treeherder, you can look up the credentials for a project like
``mozilla-central`` as follows:

  .. code-block:: python

      from treeherder.etl.oauth_utils import OAuthCredentials
      credentials = OAuthCredentials.get_credentials('mozilla-central')

The call to ``get_credentials`` obtains data directly from the
previously-generated ``treeherder/etl/data/credentials.json``.


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


Executing arbitrary SQL
-----------------------

As part of a larger change, you may want to execute some arbitrary SQL
on the server. You can do this with the `run_sql` management command.

Examples:

  .. code-block:: bash

     > ./manage.py run_sql -s <sql-statement>
     > ./manage.py run_sql -f <path-to-sql-file>

This will run the sql against the database of every project. If you want to run
against a specific project, you can do that with the `--datasources` option.
Run `./manage.py run_sql --help` for more details.


Running multiple Vagrant VMs
----------------------------

It's sometimes useful to be able to spin up an additional Vagrant
environment without affecting the first. To do this, append the
machine name `scratch` onto the standard commands. You will need to
ensure the default VM is suspended first, since otherwise the exposed
ports will clash.

  .. code-block:: bash

     $ vagrant suspend
     $ vagrant up scratch
       ...
     $ vagrant status
       Current machine states:
       default                   saved (virtualbox)
       scratch                   running (virtualbox)
     $ vagrant ssh scratch
       ...
     $ vagrant suspend scratch
     $ vagrant up
     $ vagrant status
       Current machine states:
       default                   running (virtualbox)
       scratch                   saved (virtualbox)

If you do not provide a machine name for `up` or `ssh`, the command will
apply to the `default` machine only.
