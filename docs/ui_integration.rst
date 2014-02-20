Integrating the ui
==================

If you want to develop both the ui and the service side by side it may be convenient to load the ui in the vagrant environment.
To do so, uncomment this line in the Vagrantfile

  .. code-block:: ruby
     
     #config.vm.share_folder("treeherder-ui", "/home/vagrant/treeherder-ui", "../treeherder-ui/", :nfs => nfs)

Make sure treeherder-ui is cloned in the same folder as treeherder-service (same parent folder) and reload you vagrant environment with

  .. code-block:: bash
     
     >vagrant reload

You should now be able to access the ui on http://local.treeherder.mozilla.org/ui/
