Installation
============

You can work on the UI without needing a VM, by using web-server.js.
There are a few limitations, since URL rewriting is not supported (and so some links will be broken), but it works well enough for quick testing. For instructions on how to serve the UI with working URL rewriting, see the Vagrant instructions.

Cloning the Repo
----------------

* Clone the `treeherder repo`_ from Github.

Requirements
------------

* Node.js_

Running the web-server
----------------------

* Open a shell, cd into the root of the repository you just cloned and type:

  .. code-block:: bash

     cp ui/js/config/sample.local.conf.js ui/js/config/local.conf.js
     ./web-server.js

Viewing the UI
--------------

Once the server is running, you can navigate to:
`<http://localhost:8000/index.html>`_

Configuration
=============

The sample configuration makes the UI load job/push data from the production service API. If you wish to test the UI against stage/dev's service instead, adjust ``thServiceDomain`` in the config file created as part of installation:
``ui/js/config/local.conf.js``

If you wish to run the full treeherder-service Vagrant project (service + UI), remember to remove local.conf.js or else change ``thServiceDomain`` within it to refer to ``vagrant``, so the UI will use the local Vagrant service API.

Running the unit tests
======================

The unit tests run with Karma: http://karma-runner.github.io/0.8/config/configuration-file.html

Requirements
------------

* Node.js_
* karma: ``sudo npm install -g karma``

Execution::

    ./tests/ui/scripts/test.sh

Build
=====
* Install grunt ``sudo npm install grunt-cli -g``
* Install the ``devDependencies`` in ``package.json`` by running ``npm install`` from the project root
* Run the following command in the repo root:

Build::
    grunt build

This will create a ``dist`` directory in the repo root, where concatenated and minified js, css, and application assets can be served from.

.. _treeherder repo: https://github.com/mozilla/treeherder
.. _Node.js: http://nodejs.org/download/
