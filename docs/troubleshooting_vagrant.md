# Troubleshooting Vagrant

## Errors during Vagrant setup

- The Vagrant provisioning process during `vagrant up --provision` assumes the presence of a stable internet connection. In the event of a connection interruption during provision, you may see errors similar to _"Temporary failure resolving.."_ or _"E: Unable to fetch some archives.."_ after the process has completed. In that situation, you can attempt to re-provision using the command:

  ```bash
  > vagrant provision
  ```

  Check if you have a file `/vagrant/env_local.sh`. If this file has any errors or is explicitly
  exporting any environment variables, we recommend updating it so it only has entries of `alias`
  and `function`.  
  See [Customizing Vagrant](installation.md#customizing-vagrant)

  If that is still unsuccessful, you should attempt a `vagrant destroy` followed by another `vagrant up --provision`.

- If you encounter an error saying _"mount.nfs: requested NFS version or transport protocol is not supported"_, you should restart the kernel server service using this sequence of commands:

  ```bash
  systemctl stop nfs-kernel-server.service
  systemctl disable nfs-kernel-server.service
  systemctl enable nfs-kernel-server.service
  systemctl start nfs-kernel-server.service
  ```

- If you encounter an error saying:

  > _"The guest machine entered an invalid state while waiting for it to boot.
  > Valid states are 'starting, running'. The machine is in the 'poweroff' state.
  > Please verify everything is configured properly and try again."_

  ...you should check your host machine's virtualization technology (vt-x) is enabled
  in the BIOS (see this [guide]), then continue with `vagrant up --provision`.

  [guide]: http://www.sysprobs.com/disable-enable-virtualization-technology-bios
