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

You can run flake8, isort and the py.test suite inside the Vagrant VM, using:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ ./runtests.sh

Or for more control, run each tool individually:

* `py.test <http://pytest.org/>`_:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ py.test tests/
     (venv)vagrant@local:~/treeherder$ py.test tests/log_parser/test_utils.py
     (venv)vagrant@local:~/treeherder$ py.test tests/etl/test_buildapi.py -k test_ingest_builds4h_jobs

  To run all tests, including slow tests that are normally skipped, use:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ py.test --runslow tests/

  For more options, see ``py.test --help`` or http://pytest.org/latest/usage.html

* `flake8 <https://flake8.readthedocs.io/>`_:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ flake8

  NB: If running flake8 from outside of the VM, ensure you are using the same version as used on Travis (see ``requirements/dev.txt``).

* `isort <https://github.com/timothycrosley/isort>`_ (checks the :ref:`Python import style <python-import-style>`):

  To run interactively:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ isort

  Or to apply all changes without confirmation:

  .. code-block:: bash

     (venv)vagrant@local:~/treeherder$ isort --apply

  NB: isort must be run from inside the VM, since a populated (and up to date) virtualenv is required so that isort can correctly categorise the imports.

.. _managing-api-credentials:

Profiling API endpoint performance
----------------------------------

On our development (vagrant) instance we have `django-debug-toolbar
<http://django-debug-toolbar.readthedocs.io/>`_ installed, which can give
information on exactly what SQL is run to generate individual API
endpoints. Just navigate to an endpoint
(example: http://local.treeherder.mozilla.org/api/repository/) and
you should see the toolbar to your right.

Managing API credentials
------------------------

To submit data to Treeherder's API you need Hawk credentials,
even if you're submitting to your local server. The recommended
process is slightly different for a development server versus
submitting to Treeherder staging or production, see below for
details.

Generating and using credentials on a local testing instance
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To generate credentials in the Vagrant instance run the following:

  .. code-block:: bash

      (venv)vagrant@local:~/treeherder$ ./manage.py create_credentials my-client-id treeherder@mozilla.com "Description"

The generated Hawk ``secret`` will be output to the console, which should then
be passed along with the chosen ``client_id`` to the TreeherderClient constructor.
For more details see the :doc:`submitting_data` section.

Generating and using credentials on treeherder stage or production
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Users can generate credentials for the deployed Mozilla Treeherder instances
(and view/delete existing ones) using the forms here:
`stage <https://treeherder.allizom.org/credentials/>`__ /
`production <https://treeherder.mozilla.org/credentials/>`__.
It is recommended that the same ``client_id`` string be used for both stage
and production. Once you've created your set of credentials, you can get
access to the Hawk ``secret`` by clicking on the link that should appear on the
credentials list page.

The credentials must be marked as approved by a Treeherder admin before they can
be used for submitting to the API. Request this for stage first, by filing a bug in
`Treeherder: API <https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder%3A%20API>`__.
Once any submission issues are resolved on stage, file a new bug requesting
approval for production.

Once the credentials are approved, they may be used exactly in exactly
the same way as with a local testing instance (see above).

Treeherder administrators can manage credentials here:
`stage <https://treeherder.allizom.org/admin/credentials/credentials/>`__ /
`production <https://treeherder.mozilla.org/admin/credentials/credentials/>`__.

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


Building the docs locally
-------------------------

* Either ``vagrant ssh`` into the VM, or else activate a virtualenv on the host machine.

* From the root of the Treeherder repo, run:

  .. code-block:: bash

     > pip install -r requirements/docs.txt
     > make -C docs html

* The built docs can then be found inside ``docs/_build/html/``.


Sharing UI-only changes with others using GitHub Pages
------------------------------------------------------

It's possible to share UI-only changes with others (for prototyping/testing) using
GitHub Pages. This is recommended over pushing a custom branch to stage, unless the
feature requires that you be logged into Treeherder using Persona (which won't work
cross-domain).

To do this:

* Fork the Treeherder repository to your own Github account.

* Create a gh-pages branch locally based on the feature branch you wish to test, that is configured to point at production's API. eg:

  .. code-block:: bash

     git checkout (your feature branch)
     git checkout -b gh-pages
     cp ui/js/config/sample.local.conf.js ui/js/config/local.conf.js
     git add -f ui/js/config/local.conf.js
     git commit -m "Add temp config file to make the UI use prod's API"

* Push the ``gh-pages`` branch to your Treeherder fork.

* Tell people to visit: ``https://<your-username>.github.io/treeherder/ui/``

There is no need to perform a ``grunt build`` prior. After switching away from the local gh-pages branch, you will need to recreate ``ui/js/config/local.conf.js`` if desired, due to the ``git add -f``.

Updating packages in package.json
---------------------------------

If the package is required in production/during deployment (ie: will be listed under
`dependencies` rather than `devDependencies`), the following update process must be
followed:

* Follow the instructions for installing ``nodejs`` and ``build-essential`` `here <https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions>`_, making sure to match the nodejs version specified in ``.travis.yml`` and ``package.json``.

* Update the package list in ``package.json``, making sure to specify an exact version, and not tilde or caret range notation.

* From the root of the Treeherder repo, run:

  .. code-block:: bash

     > rm -rf node_modules npm-shrinkwrap.json
     > npm install
     # Adds the packages listed under ``dependencies`` to npm-shrinkwrap.json
     > npm shrinkwrap

* Now commit the changes to both ``package.json`` and ``npm-shrinkwrap.json``.

Note: If the Vagrant host is Windows, the ``npm install`` will fail due to lack of symlink support on the host. You will need to temporarily move ``package.json`` outside of the shared folder and copy it and the resultant ``npm-shrinkwrap.json`` back when done.
