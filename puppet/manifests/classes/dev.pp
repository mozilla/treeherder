class dev{
  exec{"pip-install-dev":
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/pip install --disable-pip-version-check --require-hashes -r ${PROJ_DIR}/requirements/dev.txt",
    timeout => 1800,
  }

  exec{"migrate":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py migrate --noinput'",
    require => Exec["pip-install-dev"],
    user => "${APP_USER}",
  }

  exec{"load_initial_data":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py load_initial_data'",
    require => Exec["migrate"],
    user => "${APP_USER}",
  }

  exec{"init_datasources":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py init_datasources'",
    require => Exec["load_initial_data"],
    user => "${APP_USER}",
  }
}
