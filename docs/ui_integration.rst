Integrating the ui
==================

If you want to develop both the ui and the service side by side it may be convenient to load the ui from the vagrant environment.

* Make sure the `treeherder-ui repo`_ is cloned in the same parent folder as treeherder (and with the directory name 'treeherder-ui').

* If you previously commented out the treeherder-ui line in the Vagrantfile as part of the :doc:`installation` instructions, undo that now.

* If you have an existing Vagrant environment set up, you will need to reload it using:

  .. code-block:: bash

     >vagrant reload

You should now be able to access the ui on http://local.treeherder.mozilla.org/ui/



.. _treeherder-ui repo: https://github.com/mozilla/treeherder-ui
