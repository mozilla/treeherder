class python {

  package{[# Python2.7 is already installed, but we need to update it to the
           # latest version from the third party PPA.
           "python2.7",
           # Required by MySQLdb.
           "python-dev",
           # Required by pylibmc.
           "libmemcached-dev",
           # Required by Brotli.
           "g++",
           # To improve the UX of the Vagrant environment.
           "git"]:
    ensure => "latest",
  }

  exec { "install-pip":
    cwd => "/tmp",
    user => "${APP_USER}",
    command => "curl https://bootstrap.pypa.io/get-pip.py | sudo python -",
    creates => "/usr/local/bin/pip",
    require => [
      Package["python-dev"],
    ],
  }

  exec { "install-virtualenv":
    cwd => "/tmp",
    user => "${APP_USER}",
    command => "sudo pip install virtualenv==15.0.1",
    creates => "/usr/local/bin/virtualenv",
    require => Exec["install-pip"],
  }

  exec {
    "create-virtualenv":
    cwd => "${HOME_DIR}",
    user => "${APP_USER}",
    command => "virtualenv ${VENV_DIR}",
    creates => "${VENV_DIR}",
    require => Exec["install-virtualenv"],
  }

  exec {"activate-venv-on-login":
    unless => "grep 'source ${VENV_DIR}/bin/activate' ${HOME_DIR}/.bashrc",
    command => "echo 'source ${VENV_DIR}/bin/activate' >> ${HOME_DIR}/.bashrc",
    require => Exec["create-virtualenv"],
    user => "${APP_USER}",
  }

  exec{"pip-install-common":
    require => Exec['create-virtualenv'],
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/pip install --disable-pip-version-check --require-hashes -r ${PROJ_DIR}/requirements/common.txt",
    timeout => 1800,
  }

}
