def Kernel.is_windows?
    processor, platform, *rest = RUBY_PLATFORM.split("-")
    platform == 'mingw32'
end

Vagrant::Config.run do |config|
  config.vm.box = "precise32"
  config.vm.box_url = "http://files.vagrantup.com/precise32.box"
  config.vm.customize ["modifyvm", :id, "--memory", "512"]
  config.vm.network :hostonly, "192.168.33.10"

  # enable this to see the GUI if vagrant cannot connect
  #config.vm.boot_mode = :gui

  config.vm.provision :puppet do |puppet|
    puppet.manifests_path = "puppet/manifests"
    puppet.manifest_file = "vagrant.pp"
    # enable this to see verbose and debug puppet output
    #puppet.options = "--verbose --debug"
  end

  # Try to use NFS only on platforms other than Windows
  nfs = !Kernel.is_windows?
  config.vm.share_folder("treeherder", "/home/vagrant/treeherder-service", "./", :nfs => nfs)
end