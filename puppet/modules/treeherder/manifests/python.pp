class treeherder::python{
    package {[
        "build-essential",
        "python",
        "python-dev",
        "python-setuptools",
        #we need git to fetch packages from github
        "git-core",
        #libevent is required to install gevent
        #gotta find a better way to do it
        "libevent-dev",
        "python-pip",
        "python-virtualenv",
        "libmysqlclient-dev"
        ]: ensure => installed
    }

    package{"python-mysqldb":
        ensure => installed,
        require => [
            Class["treeherder::db"],
            Package["libmysqlclient-dev"]
        ]

        
    }

    exec{"update distribute":
        command => "pip install -q 'distribute>=0.6.28'",
        path => "/home/vagrant/venv/bin/",
        require => [
            Exec["create venv"],
        ],
        user => "vagrant"
    }

    exec{"create venv":
        command => "virtualenv /home/vagrant/venv",
        path => "/usr/local/bin:/usr/bin:/bin",
        creates => "/home/vagrant/venv",
        require => Package["python-virtualenv"],
        user => 'vagrant',
    }

    exec{"install dev requirements":
        command => "/home/vagrant/venv/bin/pip install -q -r /home/vagrant/treeherder/requirements/dev.txt",
        require => [
            Exec["update distribute"],
            Package["python-mysqldb"],
        ],
        user => 'vagrant',
    }
}