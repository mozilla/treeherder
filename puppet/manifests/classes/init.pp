# Commands to run before all others in puppet.
class init {
    group { "puppet":
        ensure => "present",
    }

    exec { "update_apt":
        command => "sudo apt-get update",
    }
}
