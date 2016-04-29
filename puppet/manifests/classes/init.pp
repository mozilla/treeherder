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

    exec { "add_elasticsearch_signing_key":
        command => "wget -qO - https://packages.elastic.co/GPG-KEY-elasticsearch | sudo apt-key --keyring /etc/apt/trusted.gpg.d/elasticsearch.gpg add -",
        creates => "/etc/apt/trusted.gpg.d/elasticsearch.gpg",
    }

    # We cannot use `add-apt-repository` per:
    # https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-repositories.html#_apt
    exec { "add_elasticsearch_repo":
        command => "echo 'deb http://packages.elastic.co/elasticsearch/2.x/debian stable main' | sudo tee -a /etc/apt/sources.list.d/elasticsearch-2.x.list",
        creates => "/etc/apt/sources.list.d/elasticsearch-2.x.list",
    }

    exec { "update_apt":
        command => "sudo apt-get update",
        require => [
            Exec["add_python27_ppa"],
            Exec["add_elasticsearch_signing_key"],
            Exec["add_elasticsearch_repo"],
        ]
    }
}
