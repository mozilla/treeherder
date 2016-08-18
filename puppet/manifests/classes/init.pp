# Commands to run before all others in puppet.
class init {
    group { "puppet":
        ensure => "present",
    }

    # Ubuntu 14.04's newest Python is v2.7.6, so we have to use a third party PPA:
    # https://launchpad.net/~fkrull/+archive/ubuntu/deadsnakes-python2.7
    exec { "add_python27_ppa":
        command => "sudo add-apt-repository ppa:fkrull/deadsnakes-python2.7",
        creates => "/etc/apt/sources.list.d/fkrull-deadsnakes-python2_7-trusty.list",
    }

    exec { "update_apt":
        command => "sudo apt-get update",
        require => [
            Exec["add_python27_ppa"],
        ]
    }
}
