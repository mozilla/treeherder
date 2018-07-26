# -*- mode: ruby -*-
# vi: set ft=ruby :

# Require a recent Vagrant to reduce the chance of issues being caused by the
# use of legacy versions (Vagrant doesn't automatically update on Windows/OS X,
# and the ubuntu.com packages are extremely out of date).
Vagrant.require_version ">= 1.9.0"

Vagrant.configure("2") do |config|
  # webpack-dev-server
  config.vm.network "forwarded_port", guest: 5000, host: 5000, host_ip: "127.0.0.1"
  # Django runserver/gunicorn
  config.vm.network "forwarded_port", guest: 8000, host: 8000, host_ip: "127.0.0.1"
  # Docs dev server
  config.vm.network "forwarded_port", guest: 8001, host: 8001, host_ip: "127.0.0.1"
  # MySQL
  config.vm.network "forwarded_port", guest: 3306, host: 3308, host_ip: "127.0.0.1"
  # Elasticsearch
  config.vm.network "forwarded_port", guest: 9200, host: 9201, host_ip: "127.0.0.1"

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
    override.vm.box_version = ">= 201802.02.0"
    vb.name = "treeherder"
    vb.memory = "3072"
  end

  config.vm.provider "hyperv" do |hv, override|
    override.vm.box = "bento/ubuntu-16.04"
    override.vm.box_version = ">= 201801.02.0"
    hv.vmname = "treeherder"
    hv.memory = "3072"
  end

  config.vm.provision "shell", privileged: false, path: "vagrant/setup.sh"
end
