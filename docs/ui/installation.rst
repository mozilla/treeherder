Installation
============

You can run the webserver locally.  For now, static data is loaded for testing
and development.


Requirements
------------

* node.js: http://nodejs.org/download/

Execution::

    cd webapp
    ./scripts/web-server.js


Endpoints
---------

Once the server is running, you can nav to:

* Jobs list: http://localhost:8000/app/index.html?tree=Try#/jobs
* Log Viewer: http://localhost:8000/app/logviewer.html


Running the unit tests
======================

The unit tests run with Karma: http://karma-runner.github.io/0.8/config/configuration-file.html


Requirements
------------

* [node.js](http://nodejs.org/download/)
* karma: ``sudo npm install -g karma``


Execution::

    cd webapp
    ./scripts/test.sh

Build
-----
* Install grunt ``sudo npm install grunt``
* Install the ``devDependencies`` in ``package.json``
* Run the following command in ``treeherder-ui``:

Build::
    grunt build

This will create a ``dist`` directory in ``treeherder-ui`` where concatenated and minified js, css, and application assets can be served from.

Configuration
=============

You can either run the treeherder service locally, or use a remote server.
This setting is specified in this file:

``webapp/app/js/config/local.conf.js``

A sample copy of this file is located here:

``webapp/app/js/config/sample.local.conf.js``

Copy the sample file to ``local.conf.js`` and make your custom settings.
