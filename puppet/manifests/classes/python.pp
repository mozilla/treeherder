class python {

  exec { "install-pip":
    cwd => "/tmp",
    user => "${APP_USER}",
    command => "curl https://bootstrap.pypa.io/get-pip.py | sudo python -",
    creates => "/usr/local/bin/pip",
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

  exec {"vendor-libmysqlclient":
    command => "${PROJ_DIR}/bin/vendor-libmysqlclient.sh ${VENV_DIR}",
    require => Exec["create-virtualenv"],
    user => "${APP_USER}",
  }

  exec{"pip-install":
    require => [
      Exec['create-virtualenv'],
      Exec['vendor-libmysqlclient'],
    ],
    user => "${APP_USER}",
    cwd => "${PROJ_DIR}",
    command => "pip install --disable-pip-version-check --require-hashes -r requirements/common.txt -r requirements/dev.txt",
    timeout => 1800,
  }

}
