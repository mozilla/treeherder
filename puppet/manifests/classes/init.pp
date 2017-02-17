# Commands to run before all others in puppet.
class init {
    # Ubuntu 14.04's newest Python is v2.7.6, so we have to use a third party PPA:
    # https://launchpad.net/~fkrull/+archive/ubuntu/deadsnakes-python2.7
    exec { "add_python27_ppa":
        command => "sudo add-apt-repository ppa:fkrull/deadsnakes-python2.7",
        creates => "/etc/apt/sources.list.d/fkrull-deadsnakes-python2_7-trusty.list",
    }

    # Ubuntu 14.04 newest openjdk is openjdk-7, so we have to use a third party PPA:
    # https://launchpad.net/~openjdk-r/+archive/ubuntu/ppa
    exec { "add_openjdk_ppa":
        command => "sudo add-apt-repository ppa:openjdk-r/ppa",
        creates => "/etc/apt/sources.list.d/openjdk-r-ppa-trusty.list",
    }

    exec { "update_apt":
        command => "sudo apt-get update",
        require => [
            Exec["add_python27_ppa"],
            Exec["add_openjdk_ppa"],
        ]
    }
}
