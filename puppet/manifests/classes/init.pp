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
