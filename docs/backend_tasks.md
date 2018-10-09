Backend tasks
==========================

Running the tests
-----------------

You can run flake8, isort and the pytest suite inside the Vagrant VM, using:

```bash
vagrant ~/treeherder$ ./runtests.sh
```

Or for more control, run each tool individually:

* [pytest](https://docs.pytest.org/en/stable/):

  ```bash
  vagrant ~/treeherder$ pytest tests/
  vagrant ~/treeherder$ pytest tests/log_parser/test_tasks.py
  vagrant ~/treeherder$ pytest tests/etl/test_job_loader.py -k test_ingest_pulse_jobs
  vagrant ~/treeherder$ pytest tests/selenium/test_pin_jobs.py::test_pin_all_jobs
  ```

  To run all tests, including slow tests that are normally skipped, use:

  ```bash
  vagrant ~/treeherder$ pytest --runslow tests/
  ```

  For more options, see `pytest --help` or <https://docs.pytest.org/en/stable/usage.html>

* [flake8](https://flake8.readthedocs.io/):

  ```bash
  vagrant ~/treeherder$ flake8
  ```

  NB: If running flake8 from outside of the VM, ensure you are using the same version as used on Travis (see ``requirements/dev.txt``).

* [isort](https://github.com/timothycrosley/isort) (checks the [Python import style](code_style.html#python-imports)):

  To run interactively:

  ```bash
  vagrant ~/treeherder$ isort
  ```

  Or to apply all changes without confirmation:

  ```bash
  vagrant ~/treeherder$ isort --apply
  ```

  NB: isort must be run from inside the VM, since a populated (and up to date) virtualenv is required so that isort can correctly categorise the imports.

Hide Jobs with Tiers
--------------------

To hide jobs we use the job's ``tier`` setting.  Jobs with ``tier`` of 3 are
hidden by default.  For TaskCluster, edit the task definition to include the
``tier`` setting in the Treeherder section.

Connecting to Services Running inside Vagrant
---------------------------------------------

Treeherder uses various services to function, eg MySQL, Elasticsearch, etc.
At times it can be useful to connect to them from outside the Vagrant VM.

The Vagrantfile defines how internal ports are mapped to the host OS' ports.
These allow one to connect to services running inside a Vagrant VM.

In the below example we're mapping VM port 3306 (MySQL's default port) to host port 3308.

  ```ruby
  config.vm.network "forwarded_port", guest: 3306, host: 3308, host_ip: "127.0.0.1"
  ```


```eval_rst
.. note::

    Any forwarded ports will block usage of that port on the host OS even if there isn't a service running inside the VM talking to it.
```

With MySQL exposed at port 3308 you can connect to it from your host OS with the following credentials:

* host: `localhost`
* port: `3308`
* user: `root`
* password: leave blank


Other services running inside the VM, such as Elasticsearch, can be accessed in the same way.


[client Git log]: https://github.com/mozilla/treeherder/commits/master/treeherder/client
[client.py]: https://github.com/mozilla/treeherder/blob/master/treeherder/client/thclient/client.py
[bug 1236965]: https://bugzilla.mozilla.org/show_bug.cgi?id=1236965

Releasing a new version of the Python client
--------------------------------------------

* Determine whether the patch, minor or major version should be bumped, by
  inspecting the [client Git log].
* File a separate bug for the version bump.
* Open a PR to update the version listed in [client.py].
* Use Twine to publish **both** the sdist and the wheel to PyPI, by running
  the following from the root of the Treeherder repository:

  ```bash
  > pip install -U twine wheel
  > cd treeherder/client/
  > rm -rf dist/*
  > python setup.py sdist bdist_wheel
  > twine upload dist/*
  ```

* File a ``Release Engineering::Buildduty`` bug requesting that the sdist
  and wheel releases (plus any new dependent packages) be added to the
  internal PyPI mirror. For an example, see [bug 1236965].