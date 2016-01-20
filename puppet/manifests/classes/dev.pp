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

  exec{"create_superuser":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py createsuperuser --username treeherder --email treeherder@mozilla.com --noinput'",
    require => Exec["migrate"],
    user => "${APP_USER}",
    unless => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py dumpdata auth.User | grep treeherder@mozilla.com'",
  }

  exec{"create_etl_credentials":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py create_credentials treeherder-etl treeherder@mozilla.com \"Treeherder etl service credentials\"'",
    require => Exec["create_superuser"],
    user => "${APP_USER}",
    unless => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py dumpdata credentials.Credentials | grep treeherder-etl'",
  }
}
