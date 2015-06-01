.. _deployment:

Deployment
==========

Serving the UI build from the dist directory
--------------------------------------------
This step required prior to deployment concatenates and minifies the js and css and moves all required assets to a directory in the project root called ``dist``. To do this, if you haven't already done so:

* As root, install grunt globally ``npm install grunt-cli -g``
* Install the ``devDependencies`` in ``package.json`` by running ``npm install`` from the project root
* Then run the following command in the repo root:

.. code-block:: bash

    grunt build


Then in ``Vagrantfile`` change ``serve_minified_ui`` to true:

.. code-block:: ruby

  puppet.facter = {
    "serve_minified_ui" => "true"
  }

You will need to run ``vagrant provision`` to pick up those changes, if the Vagrant environment was already created.
