# Commands to run before all others in puppet.
class init {
    # Ubuntu 14.04's newest Python is v2.7.6, so we have to use a third party PPA:
    # https://launchpad.net/~fkrull/+archive/ubuntu/deadsnakes-python2.7
    exec { "add_python27_ppa":
        command => "sudo add-apt-repository ppa:fkrull/deadsnakes-python2.7",
        creates => "/etc/apt/sources.list.d/fkrull-deadsnakes-python2_7-trusty.list",
    }

    exec { "add_nodejs_signing_key":
        command => "curl -sSf https://deb.nodesource.com/gpgkey/nodesource.gpg.key | sudo apt-key --keyring /etc/apt/trusted.gpg.d/nodesource.gpg add -",
        creates => "/etc/apt/trusted.gpg.d/nodesource.gpg",
    }

    exec { "add_nodejs_repository":
        command => "echo 'deb https://deb.nodesource.com/node_7.x trusty main' | sudo tee /etc/apt/sources.list.d/nodesource.list",
        creates => "/etc/apt/sources.list.d/nodesource.list",
    }

    exec { "add_yarn_signing_key":
        command => "curl -sSf https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key --keyring /etc/apt/trusted.gpg.d/yarn.gpg add -",
        creates => "/etc/apt/trusted.gpg.d/yarn.gpg",
    }

    exec { "add_yarn_repository":
        command => "echo 'deb https://dl.yarnpkg.com/debian/ stable main' | sudo tee /etc/apt/sources.list.d/yarn.list",
        creates => "/etc/apt/sources.list.d/yarn.list",
    }

    exec { "update_apt":
        command => "sudo apt-get update",
        require => [
            Exec["add_python27_ppa"],
            Exec["add_nodejs_signing_key"],
            Exec["add_nodejs_repository"],
            Exec["add_yarn_signing_key"],
            Exec["add_yarn_repository"],
        ]
    }
}
