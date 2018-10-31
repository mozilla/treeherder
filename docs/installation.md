Installation
============

Prerequisites
-------------

* If you are new to Mozilla or the A-Team, read the [A-Team Bootcamp].
* Install [Git]
* Clone the [treeherder repo] from GitHub.

If you only want to hack on the frontend, see the UI Development section below. If you want to hack on the backend or work full-stack, see the [Server and Full-stack Development](#server-and-full-stack-development) section.

UI Development
==============

To get started:

* Install [Node.js] and [Yarn] (see [package.json] for known compatible versions, listed under `engines`).
* Run ``yarn install`` to install all dependencies.

Running the standalone development server
-----------------------------------------

The default development server runs the unminified UI and fetches data from the
production site. You do not need to set up the Vagrant VM unless making backend changes.
 
* Start the development server by running:

  ```bash
  $ yarn start
  ```

```eval_rst
.. note::

  Any action you take, such as classifying a job, will affect the live production front-end of Treeherder so we recommend developing against `stage` (details below) unless there's something data-specific that must be addressed on production.
```

* The server will perform an initial build and then watch for new changes. Once the server is running, you can navigate to: <http://localhost:5000> to see the UI.

  To run the unminified UI with data from the staging site instead of the production site, type:

  ```bash
  $ yarn start:stage
  ```

  If you need to serve data from another domain, type:

  ```bash
  $ BACKEND=<url> yarn start
  ```

  This will run the unminified UI using ``<url>`` as the service domain.

Validating JavaScript
---------------------

We run our JavaScript code in the frontend through [eslint] to ensure
that new code has a consistent style and doesn't suffer from common
errors. Eslint will run automatically when you build the JavaScript code
or run the  development server. A production build will fail if your code
does not match the style requirements.

To run eslint by itself, you may run the lint task:

```bash
$ yarn lint
```

Running the unit tests
----------------------

The unit tests for the UI are run with [Karma] and [Jasmine]. React components are tested with [enzyme]. 

To run the tests:

* If you haven't already done so, install local dependencies by running ``yarn install`` from the project root.
* Then run ``yarn test`` to execute the tests.

While working on the frontend, you may wish to watch JavaScript files and re-run tests
automatically when files change. To do this, you may run the following command:

```bash
$ yarn test:watch
```

The tests will perform an initial run and then re-execute each time a project file is changed.

Continue to the [Code Style](code_style.md) doc.

Server and Full-stack Development
=================================

To get started:

* Install [Virtualbox] and [Vagrant] (latest versions recommended).
* Linux only: An nfsd server is required. You can install this on Ubuntu by running `apt-get install nfs-common nfs-kernel-server`

Setting up Vagrant
------------------

* Open a shell, cd into the root of the Treeherder repository, and type:

  ```bash
  > vagrant up --provision
  ```

  It will typically take 5 to 30 minutes for the vagrant provision to
  complete, depending on your network performance. If you experience
  any errors, see the [troubleshooting page](troubleshooting.md).

  It is *very important* that the provisioning process complete successfully before
  trying to interact with your test instance of treeherder: some things might
  superficially seem to work a partially configured machine, but
  it is almost guaranteed that some things *will break* in
  hard-to-diagnose ways if vagrant provision is not run to completion.

* Once the virtual machine is set up, connect to it using:

  ```bash
  > vagrant ssh
  ```

  A python virtual environment will be activated on login, and the working directory will be the treeherder source directory shared from the host machine.

* For the full list of available Vagrant commands (for example, suspending the VM when you are finished for the day),
  see their [command line documentation](https://www.vagrantup.com/docs/cli/).

* If you just wish to [run the tests](common_tasks.html#running-the-tests),
  you can stop now without performing the remaining steps.

Starting a local Treeherder instance
------------------------------------

* Start a gunicorn instance inside the Vagrant VM, to serve the static UI and API requests:

  ```bash
  vagrant ~/treeherder$ ./bin/run_gunicorn
  ```

  Or for development you can use the django runserver instead of gunicorn:

  ```bash
  vagrant ~/treeherder$ ./manage.py runserver
  ```

  this is more convenient because it automatically refreshes every time there's a change in the code.

* You must also start the UI dev server. Open a new terminal window and ``vagrant ssh`` to
  the VM again, then run the following:

  ```bash
  vagrant ~/treeherder$ yarn start:local
  ```

  This will build the UI code and keep watching for new changes.

* Visit <http://localhost:5000> in your browser (NB: port has changed). Note: There will be no data to display until the ingestion tasks are run.

Building the minified UI with Vagrant
-------------------------------------
If you would like to view the minified production version of the UI with Vagrant, follow this step:

* Run the build task (either outside or inside of the Vagrant machine):

  ```bash
  $ yarn build
  ```

Once the build is complete, the minified version of the UI will now be accessible at
<http://localhost:8000> (NB: port 8000, unlike above).

Validating JavaScript
---------------------

We run our JavaScript code in the frontend through [eslint] to ensure
that new code has a consistent style and doesn't suffer from common
errors. Eslint will run automatically when you build the JavaScript code
or run the  development server. A production build will fail if your code
does not match the style requirements.

To run eslint by itself, you may run the lint task:

```bash
$ yarn lint
```

Running the ingestion tasks
---------------------------

Ingestion tasks populate the database with version control push logs, queued/running/completed jobs & output from log parsing, as well as maintain a cache of intermittent failure bugs. To run these:

* Start up a celery worker to process async tasks:

  ```bash
  vagrant ~/treeherder$ celery -A treeherder worker -B --concurrency 5
  ```

  The "-B" option tells the celery worker to startup a beat service, so that periodic tasks can be executed.
  You only need one worker with the beat service enabled. Multiple beat services will result in periodic tasks being executed multiple times.

* Then in a new terminal window, run `vagrant ssh` again, and follow the steps from the [loading pulse data](pulseload.md) page.

Ingesting a single push (at a time)
-----------------------------------

```eval_rst
.. warning::
  With the end of life of buildbot, this command is no longer able to ingest jobs.
  For now after running it, you will need to manually follow the steps from the
  :doc:`loading pulse data<pulseload>` page.
```

Alternatively, instead of running a full ingestion task, you can process just
the jobs associated with any single push generated in the last 4 hours
([builds-4h]), in a synchronous manner. This is ideal for testing. For example:

[builds-4h]: http://builddata.pub.build.mozilla.org/buildjson/

```bash
vagrant ~/treeherder$ ./manage.py ingest_push mozilla-inbound 63f8a47cfdf5
```

If running this locally, replace `63f8a47cfdf5` with a recent revision (= pushed within
the last four hours) on mozilla-inbound.

Ingesting a range of pushes
---------------------------

It is also possible to ingest the last N pushes for a repository:

```bash
vagrant ~/treeherder$ ./manage.py ingest_push mozilla-central --last-n-pushes 100
```

In this mode, only the pushlog data will be ingested: additional results
associated with the pushes will not. This mode is useful to seed pushes so
they are visible on the web interface and so you can easily copy and paste
changesets from the web interface into subsequent ``ingest_push`` commands.


Continue to **Working with the Server** section after looking at the [Code Style](code_style.md) doc.


[A-Team Bootcamp]: https://ateam-bootcamp.readthedocs.io
[Git]: https://git-scm.com
[Vagrant]: https://www.vagrantup.com
[Virtualbox]: https://www.virtualbox.org
[treeherder repo]: https://github.com/mozilla/treeherder
[Karma]: http://karma-runner.github.io/0.8/config/configuration-file.html
[Node.js]: https://nodejs.org/en/download/current/
[Yarn]: https://yarnpkg.com/en/docs/install
[package.json]: https://github.com/mozilla/treeherder/blob/master/package.json
[eslint]: https://eslint.org
[Jasmine]: https://jasmine.github.io/
[enzyme]: http://airbnb.io/enzyme/
