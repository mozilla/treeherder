Common tasks
============


.. _running-tests:

Running the tests
-----------------

You can run flake8, isort and the pytest suite inside the Vagrant VM, using:

  .. code-block:: bash

     vagrant ~/treeherder$ ./runtests.sh

Or for more control, run each tool individually:

* `pytest <https://docs.pytest.org/en/stable/>`_:

  .. code-block:: bash

     vagrant ~/treeherder$ pytest tests/
     vagrant ~/treeherder$ pytest tests/log_parser/test_tasks.py
     vagrant ~/treeherder$ pytest tests/etl/test_buildapi.py -k test_ingest_builds4h_jobs
     vagrant ~/treeherder$ pytest tests/selenium/test_basics.py::test_treeherder_main

  NB: You can run the Selenium tests headlessly by setting the ``MOZ_HEADLESS``
  environment variable.

  To run all tests, including slow tests that are normally skipped, use:

  .. code-block:: bash

     vagrant ~/treeherder$ pytest --runslow tests/

  For more options, see ``pytest --help`` or https://docs.pytest.org/en/stable/usage.html

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

For more information on adding a new GitHub repository
see :ref:`Add GitHub repository <add-github-repo>`.


Building the docs locally
-------------------------

* Either ``vagrant ssh`` into the VM, or else activate a virtualenv on the host machine.
* From the root of the Treeherder repo, run:

  .. code-block:: bash

     > pip install -r requirements/docs.txt
     > make -C docs livehtml

* Visit http://127.0.0.1:8000 to view the docs.
* Source changes will result in automatic rebuilds and browser page reload.


Updating package.json
---------------------

* Always use ``yarn`` to make changes, not ``npm``, so that ``yarn.lock`` remains in sync.
* Add new packages using ``yarn add <PACKAGE>`` (``yarn.lock`` will be automatically updated).
* After changes to ``package.json`` use ``yarn install`` to install them and automatically update ``yarn.lock``.
* For more details see the `Yarn documentation`_.

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

Hide Jobs with Tiers
--------------------

To hide jobs we use the job's ``tier`` setting.  Jobs with ``tier`` of 3 are
hidden by default.  There are two ways to set a job to be hidden in Treeherder:

* TaskCluster - Edit the task definition to include the ``tier`` setting in
  the Treeherder section.
* BuildBot - You must get the signature hash of the job from the UI and add that
  signature hash to the ``buildapi.py`` file in the Treeherder repo.  To get
  the signature, click the job and then click the ``sig`` link in the Job
  Details Panel.  That will place the signature hash in the filter field.


.. _client Git log: https://github.com/mozilla/treeherder/commits/master/treeherder/client
.. _client.py: https://github.com/mozilla/treeherder/blob/master/treeherder/client/thclient/client.py
.. _bug 1236965: https://bugzilla.mozilla.org/show_bug.cgi?id=1236965
