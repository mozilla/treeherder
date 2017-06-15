# -*- mode: ruby -*-
# vi: set ft=ruby :

# Require a recent Vagrant to reduce the chance of issues being caused by the
# use of legacy versions (Vagrant doesn't automatically update on Windows/OS X,
# and the ubuntu.com packages are extremely out of date).
Vagrant.require_version ">= 1.9.0"

Vagrant.configure("2") do |config|
  # for webpack-devserver access from host
  config.vm.network "forwarded_port", guest: 5000, host: 5000, host_ip: "127.0.0.1"
  # for web server access from host
  config.vm.network "forwarded_port", guest: 8000, host: 8000, host_ip: "127.0.0.1"
  # for DB access from host
  config.vm.network "forwarded_port", guest: 3306, host: 3308, host_ip: "127.0.0.1"

  if !Vagrant::Util::Platform.windows?
    # On platforms where NFS is used (ie all but Windows), we still have to use
    # Virtualbox's hostonly networking mode so that NFS works.
    config.vm.network "private_network", type: "dhcp"
  end

  config.vm.synced_folder ".", "/home/vagrant/treeherder", type: "nfs"

  config.vm.provider "virtualbox" do |vb, override|
    # The Bento boxes (https://github.com/chef/bento) are recommended over the
    # Canonical ones, since they more closely follow Vagrant best practices.
    override.vm.box = "bento/ubuntu-16.04"
    override.vm.box_version = ">= 2.3.5"
    vb.name = "treeherder"
    vb.memory = "3072"
    vb.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
    vb.customize ["modifyvm", :id, "--natdnsproxy1", "on"]
  end

  config.vm.provider "hyperv" do |hv, override|
    override.vm.box = "ericmann/trusty64"
    hv.vmname = "treeherder"
    hv.memory = "3072"
  end

  config.vm.provision "shell", privileged: false, path: "vagrant/setup.sh"
end
