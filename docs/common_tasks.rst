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


.. _add-hg-repo:

Add a new Mercurial repository
------------------------------

To add a new repository, the following steps are needed:

* Append new repository information to the fixtures file located at treeherder/model/fixtures/repository.json
* Load the file you edited with the loaddata command:

  .. code-block:: bash

     vagrant ~/treeherder$ ./manage.py loaddata repository

* Restart any running gunicorn/celery processes.

For more information on adding a new Github repository
see :ref:`Add Github repository <add-github-repo>`.


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
     yarn run build
     git add -f ui/js/config/local.conf.js dist/
     git commit -m "Add temp config file and dist directory to make the UI use prod's API"

* Push the ``gh-pages`` branch to your Treeherder fork.

* Tell people to visit: ``https://<your-username>.github.io/treeherder/dist/``

Updating package.json
---------------------

* Always use ``yarn`` to make changes, not ``npm``, so that ``yarn.lock`` remains in sync.
* Add new packages using ``yarn add <PACKAGE> --no-bin-links`` (``yarn.lock`` will be automatically updated).
* After changes to ``package.json`` use ``yarn install --no-bin-links`` to install them and automatically update ``yarn.lock``.
* For more details see the `Yarn documentation`_.

Note: To work around symlink issues for Windows hosts, use ``--no-bin-links`` with any command that adds/modifies packages. Whilst this is technically unnecessary with non-Windows hosts, it's still recommended since otherwise your local changes might inadvertently rely on ``node_modules/.bin/`` symlinks that won't exist in a newly created Vagrant environment. Unfortunately yarn doesn't yet support setting this option via the global yarn config, otherwise we could just enable it by default.

.. _Yarn documentation: https://yarnpkg.com/en/docs/usage


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
