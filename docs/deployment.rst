Deployment
==========

Testing the UI build locally
----------------------------

During local development the UI is served in its original, unprocessed form. In
production, a minified/built version of the UI (generated using grunt) is used instead.

To build the UI locally:

* Install the Grunt wrapper globally by running as root ``npm install -g grunt-cli``
  (alternatively replace references to ``grunt`` with ``./node_modules/.bin/grunt``).
* Install local dependencies by running ``npm install`` from the project root.
* Run ``grunt build`` to create the ``dist`` directory.

Then to serve assets from this directory instead of ``ui/``, in the Vagrant environment
set ``SERVE_MINIFIED_UI=True`` before starting gunicorn/runserver.
