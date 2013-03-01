# -*- mode: ruby -*-
# vi: set ft=ruby :

BASE_DIR = "/home/vagrant/treeherder"

Vagrant::Config.run do |config|  
  config.vm.box = "precise32"
  config.vm.box_url = "http://files.vagrantup.com/precise32.box"
  config.vm.network :hostonly, "192.168.33.10"
  config.vm.share_folder "treeherder", BASE_DIR, "."

  config.vm.provision :puppet do |puppet|
    puppet.manifests_path = "puppet/manifests"
    puppet.manifest_file  = "init.pp"
    puppet.module_path = "puppet/modules"
  end
end