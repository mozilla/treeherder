Deployment
==========

Serving the UI build from the dist directory
--------------------------------------------

During local development the UI is served in its original, unprocessed form. In
production, a minified/built version of the UI (generated using grunt) is used instead.

To serve the built version of the UI locally, set ``SERVE_MINIFIED_UI`` to True in
the environment before starting gunicorn/runserver.


Generating the UI build prior to deployment
-------------------------------------------

Building the UI requires Node.js which is not installed on production, so the
build output has to be checked into the repo. As such, prior to deployment, this
must be performed manually. To do this:

* Install the Grunt wrapper globally by running as root ``npm install -g grunt-cli``
* Install local dependencies by running as root ``npm install`` from the project root
* Run ``grunt build`` to created the ``dist`` directory.
* Commit the result to the repo with a commit message similar to ``update grunt build``.
