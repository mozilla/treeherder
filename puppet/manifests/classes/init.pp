# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

# Commands to run before all others in puppet.
class init {
    group { "puppet":
        ensure => "present",
    }

    if $operatingsystem == 'Ubuntu'{
      exec { "update_apt":
          command => "sudo apt-get update"
      }

      # Required for add-apt-repository
      package { python-software-properties:
          ensure => installed,
          require => Exec["update_apt"],
      }

      # Ubuntu 12.04's newest Python is v2.7.3, so we have to use a third party PPA:
      # https://launchpad.net/~fkrull/+archive/ubuntu/deadsnakes-python2.7
      exec { "add_python27_ppa":
          command => "sudo add-apt-repository ppa:fkrull/deadsnakes-python2.7",
          require => Package['python-software-properties'],
      }

      # Need to update again to pick up the new Python 2.7.9 packages from the PPA
      exec { "update_apt_for_ppa":
          command => "sudo apt-get update",
          require => Exec["add_python27_ppa"],
      }
    }
}
