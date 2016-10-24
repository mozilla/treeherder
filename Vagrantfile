# -*- mode: ruby -*-
# vi: set ft=ruby :

# We require 1.5+ due to specifying only the box name and not config.vm.box_url.
Vagrant.require_version ">= 1.5.0"

def puppet_provisioner(config)
  config.vm.provision "puppet" do |puppet|
    puppet.manifests_path = "puppet/manifests"
    puppet.manifest_file = "vagrant.pp"

    # enable this to see verbose and debug puppet output
    #puppet.options = "--verbose --debug"
  end
end

Vagrant.configure("2") do |config|
  config.vm.hostname = "local.treeherder.mozilla.org"
  config.vm.network "private_network", ip: "192.168.33.10"

  config.vm.synced_folder ".", "/home/vagrant/treeherder", type: "nfs"

  config.vm.provider "virtualbox" do |vb, override|
    override.vm.box = "ubuntu/trusty64"
    vb.name = "treeherder"
    vb.memory = "2048"

    puppet_provisioner(override)
  end

  config.vm.provider "hyperv" do |hv, override|
    override.vm.box = "ericmann/trusty64"
    hv.vmname = "treeherder"
    hv.memory = "2048"

    # Hyper-V box doesn't have Puppet installed. So install it manually.
    override.vm.provision "install-puppet", type: "shell" do |s|
      s.inline = "apt-get update && apt-get -y install puppet"
    end

    puppet_provisioner(override)
  end
end
