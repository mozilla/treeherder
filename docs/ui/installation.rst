Installation
============

It's possible to work on the UI without setting up the Vagrant VM. There are a
few limitations, such as login not being available, but it works well enough for
quick testing. For instructions on how to serve the UI with working URL rewriting,
see the Vagrant instructions.

To get started:

* Clone the `treeherder repo`_ from Github.
* Install `Node.js`_ if not present.
* Open a shell, cd into the root of the repository you just cloned and run ``npm install`` to install all dependencies.

Running the standalone development server
-----------------------------------------

The default development server runs the unminified UI and fetches data from the
production site. You do not need to set up the Vagrant VM, but login will be unavailable.

* Start the development server by running:

  .. code-block:: bash

     $ npm start

* The server will perform an initial build and then watch for new changes. Once the server is running, you can navigate to: `<http://localhost:5000>`_ to see the UI.

  To run the unminified UI with data from the staging site instead of the production site, type:

  .. code-block:: bash

     $ npm run start:stage

  If you need to serve data from another domain, type:

  .. code-block:: bash

    $ SERVICE_DOMAIN=<url> npm start

  This will run the unminified UI using ``<url>`` as the service domain.

Running the unminified UI with Vagrant
--------------------------------------
You may also run the unminified UI using the full treeherder Vagrant project.

First, make sure you have set up Vagrant and ingested some data as described in the main
installation instructions, then follow these steps:

* Start the treeherder service inside of Vagrant, like this:

  .. code-block:: bash

    $ vagrant up
    $ vagrant ssh
    vagrant ~/treeherder$ ./manage.py runserver

* Then, oustide of vagrant run:

  .. code-block:: bash

    $ npm run start:local

This will watch UI files for changes and build an unminified version in the ``dist/`` directory.
Note that this process is a little slower than using the regular development server, so you may
wish to use it only for development that requires a frontend login.

Building the minified UI with Vagrant
-------------------------------------
If you would like to view the minified production version of the UI with Vagrant, follow these steps:

* First, build the minified code like this:

 .. code-block:: bash

    $ npm run build


* Then start the treeherder service inside of Vagrant, like this:

  .. code-block:: bash

    vagrant up
    vagrant ssh
    ./manage.py runserver

The minified version of the UI will now be accessible at http://localhost:8000.

Configuration
=============

Please note that if ``ui/js/config/local.conf.js`` exists, the above configuration will be overwritten by the ``thServiceDomain`` defined in that config file.

If you wish to run the full treeherder Vagrant project (service + UI), remember to remove local.conf.js or else change ``thServiceDomain`` within it to refer to ``vagrant``, so the UI will use the local Vagrant service API.

Validating JavaScript
=====================

We run our JavaScript code in the frontend through eslint_ to ensure
that new code has a consistent style and doesn't suffer from common
errors. Eslint will run automatically when you build the JavaScript code
or run the  development server. A production build will fail if your code
does not match the style requirements in ``.eslintrc``.

Running the unit tests
======================

The unit tests for the UI are run with Karma_ and Jasmine_. React components are tested with enzyme_. To run the tests:

* If you haven't already done so, install local dependencies by running ``npm install`` from the project root.
* Then run the following command to execute the tests:

.. code-block:: bash

    $ npm test

After the tests have finished, you can find a coverage report in the `coverage/` directory.

Watching the test files
-----------------------
While working on the frontend, you may wish to watch JavaScript files and re-run tests
automatically when files change. To do this, you may run the following command:

.. code-block:: bash

    $ npm run test:watch

The tests will perform an initial run and then re-execute each time a project file is changed.

.. _Karma: http://karma-runner.github.io/0.8/config/configuration-file.html
.. _treeherder repo: https://github.com/mozilla/treeherder
.. _Node.js: http://nodejs.org/download/
.. _eslint: http://eslint.org
.. _Jasmine: https://jasmine.github.io/
.. _enzyme: http://airbnb.io/enzyme/
