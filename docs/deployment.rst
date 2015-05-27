Deployment
==========

Serving the UI build from the distribution directory
----------------------------------------------------
To serve the UI from the ``dist`` directory, run:

.. code-block:: bash

  (venv)vagrant@precise32:~/treeherder$ grunt build

This will build the UI by concatenating and minifying the js and css and move all required assets to a directory called ``dist`` in the repository root. Then in ``Vagrantfile`` change ``serve_minified_ui`` to true:

.. code-block:: ruby

  puppet.facter = {
    "serve_minified_ui" => "true"
  }

You will need to run ``vagrant provision`` to pick up those changes, if the Vagrant environment was already created.
