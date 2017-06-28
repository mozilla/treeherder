Deployment
==========

Testing the UI build locally
----------------------------

During local development the UI is served in its original, unprocessed form. In
production, a minified/built version of the UI (generated using webpack) is used instead.

To build the UI locally:

* Install local dependencies by running ``yarn install --no-bin-links`` from the project root.
* Run ``yarn build`` to create the ``dist`` directory.

Then start gunicorn/runserver as usual.
