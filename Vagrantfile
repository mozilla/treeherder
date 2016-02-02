# -*- mode: ruby -*-
# vi: set ft=ruby :

# We require 1.5+ due to specifying only the box name and not config.vm.box_url.
Vagrant.require_version ">= 1.5.0"

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty32"

  config.vm.hostname = "local.treeherder.mozilla.org"
  config.vm.network "private_network", ip: "192.168.33.10"

  config.vm.synced_folder ".", "/home/vagrant/treeherder", type: "nfs"

  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"
  end

  config.vm.provision "puppet" do |puppet|
    puppet.manifests_path = "puppet/manifests"
    puppet.manifest_file = "vagrant.pp"

    # enable this to see verbose and debug puppet output
    #puppet.options = "--verbose --debug"
  end

end
