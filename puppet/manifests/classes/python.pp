# Install python and compiled modules for project
class python {
    package {
        ["python2.7-dev", "python2.7", "python-pip", "python-virtualenv", "git"]:
            ensure => installed;
    }

    exec { "create-virtualenv":
        command => "virtualenv /home/vagrant/venv/",
        creates => "/home/vagrant/venv/",
        require => [
            Package['python-virtualenv'],
        ],
        user => "vagrant"
    }

    exec { "update-distribute":
        command => "/home/vagrant/venv/bin/pip install --upgrade distribute",
        require => [
            Package['python-pip'],
            Exec['create-virtualenv'],
        ]
    }

    file { "vendor.pth":
        path => "/home/vagrant/venv/lib/python2.7/site-packages/vendor.pth",
        ensure => present,
        content => "$PROJ_DIR/vendor/",
        require => Exec["create-virtualenv"],
    }

    exec { "pip-install-requirements":
        command => "/home/vagrant/venv/bin/pip install \
        -r $PROJ_DIR/requirements/compiled.txt -r $PROJ_DIR/requirements/dev.txt \
        -r $PROJ_DIR/requirements/pure.txt",
        require => [
            Package['python-pip'],
            Package['git'],
            Exec['update-distribute'],
            Exec['create-virtualenv'],
        ],
        user => "vagrant",
    }

    exec {"activate-venv-on-login":
        unless => "cat /home/vagrant/.bashrc | grep 'source venv/bin/activate'",
        command => "echo 'source venv/bin/activate' >> /home/vagrant/.bashrc",
        require => Exec["create-virtualenv"],
        user => vagrant
    }
}
