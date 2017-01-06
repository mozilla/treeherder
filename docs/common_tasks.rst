Common tasks
============


.. _running-tests:

Running the tests
-----------------

You can run flake8, isort and the py.test suite inside the Vagrant VM, using:

  .. code-block:: bash

     vagrant ~/treeherder$ ./runtests.sh

Or for more control, run each tool individually:

* `py.test <http://pytest.org/>`_:

  .. code-block:: bash

     vagrant ~/treeherder$ py.test tests/
     vagrant ~/treeherder$ py.test tests/log_parser/test_tasks.py
     vagrant ~/treeherder$ py.test tests/etl/test_buildapi.py -k test_ingest_builds4h_jobs

  To run all tests, including slow tests that are normally skipped, use:

  .. code-block:: bash

     vagrant ~/treeherder$ py.test --runslow tests/

  For more options, see ``py.test --help`` or http://pytest.org/latest/usage.html

* `flake8 <https://flake8.readthedocs.io/>`_:

  .. code-block:: bash

     vagrant ~/treeherder$ flake8

  NB: If running flake8 from outside of the VM, ensure you are using the same version as used on Travis (see ``requirements/dev.txt``).

* `isort <https://github.com/timothycrosley/isort>`_ (checks the :ref:`Python import style <python-import-style>`):

  To run interactively:

  .. code-block:: bash

     vagrant ~/treeherder$ isort

  Or to apply all changes without confirmation:

  .. code-block:: bash

     vagrant ~/treeherder$ isort --apply

  NB: isort must be run from inside the VM, since a populated (and up to date) virtualenv is required so that isort can correctly categorise the imports.


Profiling API endpoint performance
----------------------------------

On our development (vagrant) instance we have `django-debug-toolbar
<http://django-debug-toolbar.readthedocs.io/>`_ installed, which can give
information on exactly what SQL is run to generate individual API
endpoints. Just navigate to an endpoint
(example: http://localhost:8000/api/repository/) and
you should see the toolbar to your right.


Add a new repository
--------------------

To add a new repository, the following steps are needed:

* Append new repository information to the fixtures file located at treeherder/model/fixtures/repository.json
* Load the file you edited with the loaddata command:

  .. code-block:: bash

     vagrant ~/treeherder$ ./manage.py loaddata repository

* Restart any running gunicorn/celery processes.


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
feature requires that you be logged into Treeherder (which won't work
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


Releasing a new version of the Python client
--------------------------------------------

* Determine whether the patch, minor or major version should be bumped, by
  inspecting the `client Git log`_.
* File a separate bug for the version bump.
* Open a PR to update the version listed in `client.py`_.
* Use Twine to publish **both** the sdist and the wheel to PyPI, by running
  the following from the root of the Treeherder repository:

  .. code-block:: bash

      > pip install -U twine wheel
      > cd treeherder/client/
      > rm -rf dist/*
      > python setup.py sdist bdist_wheel
      > twine upload dist/*

* File a ``Release Engineering::Buildduty`` bug requesting that the sdist
  and wheel releases (plus any new dependent packages) be added to the
  internal PyPI mirror. For an example, see `bug 1236965`_.

.. _client Git log: https://github.com/mozilla/treeherder/commits/master/treeherder/client
.. _client.py: https://github.com/mozilla/treeherder/blob/master/treeherder/client/thclient/client.py
.. _bug 1236965: https://bugzilla.mozilla.org/show_bug.cgi?id=1236965
