treeherder-ui
=============


Local Development: Running the web server
-----------------------------------------

-----------------------

You can run the webserver locally.  For now, static data is loaded for testing
and development.


### Requirements

* [node.js](http://nodejs.org/download/)

### Execution

    cd webapp
    ./scripts/web-server.js


### Endpoints

Once the server is running, you can nav to:

* [Jobs list](http://localhost:8000/app/index.html?tree=Try#/jobs)
* [Log Viewer](http://localhost:8000/app/logviewer.html)


Running the unit tests
----------------------

-----------------------

The unit tests run with [Karma](http://karma-runner.github.io/0.8/config/configuration-file.html).


### Requirements

* [node.js](http://nodejs.org/download/)
* karma: ``sudo npm install -g karma``


### Execution

    cd webapp
    ./scripts/test.sh


Configuration
-------------

-------------

You can either run the treeherder service locally, or use a remote server.
This setting is specified in this file:

    webapp/app/js/config/local.conf.js

A sample copy of this file is located here:

    webapp/app/js/config/sample.local.conf.js

Copy the sample file to ``local.conf.js`` and make your custom settings.