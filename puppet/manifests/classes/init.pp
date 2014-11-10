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
    }
}
