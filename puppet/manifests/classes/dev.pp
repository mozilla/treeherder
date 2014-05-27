class dev{
  exec{"pip-install-dev":
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/pip install --download-cache=/home/${APP_USER}/pip_cache -r ${PROJ_DIR}/requirements/dev.txt",
    timeout => 1800,
  }

  exec{"init_master_db":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py init_master_db --noinput'",
    user => "${APP_USER}",
  }

  exec{"init_datasources":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py init_datasources'",
    require => Exec["init_master_db"],
    user => "${APP_USER}",
  }
}
