Installation
============

You can work on the UI without needing a VM, by using web-server.js.
There are a few limitations, such as Persona login not working (bug 1168797), but it works well enough for quick testing. For instructions on how to serve the UI with working URL rewriting, see the Vagrant instructions.

Cloning the Repo
----------------

* Clone the `treeherder repo`_ from Github.

Running the web-server
----------------------

* Install `Node.js`_ if not present.
* Open a shell, cd into the root of the repository you just cloned and type:

  .. code-block:: bash

     cp ui/js/config/sample.local.conf.js ui/js/config/local.conf.js
     ./web-server.js

Viewing the UI
--------------

Once the server is running, you can navigate to:
`<http://localhost:8000>`_

Configuration
=============

The sample configuration makes the UI load job/push data from the production service API. If you wish to test the UI against stage/dev's service instead, adjust ``thServiceDomain`` in the config file created as part of installation:
``ui/js/config/local.conf.js``

If you wish to run the full treeherder Vagrant project (service + UI), remember to remove local.conf.js or else change ``thServiceDomain`` within it to refer to ``vagrant``, so the UI will use the local Vagrant service API.

Validating JavaScript
=====================

We run our JavaScript code in the frontend through eslint_ to ensure
that new code has a consistent style and doesn't suffer from common
errors. Before submitting a patch, check that your code passes these tests.

* If you haven't already done so, install local dependencies by
  running as root ``npm install`` from the project root
* Run ``grunt checkjs``. You will see errors if your code has problems

.. _eslint: http://eslint.org/

Running the unit tests
======================

The unit tests for the UI are run with Karma_. To do this:

* Install the Karma wrapper globally by running as root ``npm install -g karma-cli``
* If you haven't already done so, install local dependencies by
  running as root ``npm install`` from the project root
* Then run the following command to execute the tests:

.. code-block:: bash

    ./tests/ui/scripts/test.sh

.. _Karma: http://karma-runner.github.io/0.8/config/configuration-file.html
.. _treeherder repo: https://github.com/mozilla/treeherder
.. _Node.js: http://nodejs.org/download/

