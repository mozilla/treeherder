# -*- mode: ruby -*-
# vi: set ft=ruby :

# TODO: Switch from Vagrant to a docker/docker-compose based environment (bug 1169263).

# Require a recent Vagrant to reduce the chance of issues being caused by the
# use of legacy versions (Vagrant doesn't automatically update on Windows/OS X,
# and the ubuntu.com packages are extremely out of date).
Vagrant.require_version ">= 2.1.5"

Vagrant.configure("2") do |config|
  # webpack-dev-server
  config.vm.network "forwarded_port", guest: 5000, host: 5000, host_ip: "127.0.0.1"
  # Django runserver/gunicorn/mkdocs serve
  config.vm.network "forwarded_port", guest: 8000, host: 8000, host_ip: "127.0.0.1"
  # MySQL
  config.vm.network "forwarded_port", guest: 3306, host: 3308, host_ip: "127.0.0.1"

  if !Vagrant::Util::Platform.windows?
    # On platforms where NFS is used (ie all but Windows), we still have to use
    # Virtualbox's hostonly networking mode so that NFS works.
    config.vm.network "private_network", type: "dhcp"
  end

  config.vm.synced_folder ".", "/home/vagrant/treeherder", type: "nfs"

  # The Bento boxes (https://github.com/chef/bento) are recommended over the
  # Canonical ones, since they more closely follow Vagrant best practices.
  config.vm.box = "bento/ubuntu-18.04"
  config.vm.box_version = ">= 201808.24.0"

  config.vm.provider "virtualbox" do |vb|
    vb.name = "treeherder"
    vb.memory = "3072"
  end

  config.vm.provision "shell", privileged: false, path: "vagrant/setup.sh"
end
