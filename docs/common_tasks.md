Common tasks
============

Building the docs locally
-------------------------

* Either ``vagrant ssh`` into the VM, or else activate a virtualenv on the host machine.
* From the root of the Treeherder repo, run:

  ```bash
  > pip install -r requirements/docs.txt
  > make livehtml
  ```

* Visit <http://127.0.0.1:8001> to view the docs.
* Source changes will result in automatic rebuilds and browser page reload.

Updating package.json
---------------------

* Always use ``yarn`` to make changes, not ``npm``, so that ``yarn.lock`` remains in sync.
* Add new packages using ``yarn add <PACKAGE>`` (``yarn.lock`` will be automatically updated).
* After changes to ``package.json`` use ``yarn install`` to install them and automatically update ``yarn.lock``.
* For more details see the [Yarn documentation].

[Yarn documentation]: https://yarnpkg.com/en/docs/usage

Add a new Mercurial repository
------------------------------

To add a new repository, the following steps are needed:

* Append new repository information to the fixtures file located at:
  `treeherder/model/fixtures/repository.json`
* Load the file you edited with the loaddata command:

  ```bash
  vagrant ~/treeherder$ ./manage.py loaddata repository
  ```

* Restart any running gunicorn/celery processes.

For more information on adding a new GitHub repository, see
[Adding a GitHub repository](submitting_data.html#adding-a-github-repository).

