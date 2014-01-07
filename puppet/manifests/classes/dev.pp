class dev{
  exec{"pip-install-dev":
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/pip install --download-cache=/home/${APP_USER}/pip_cache -r ${PROJ_DIR}/requirements/dev.txt",
    timeout => 1800,
  }

  exec{"init_master_db":
    cwd => '/home/vagrant/treeherder-service',
    command => "${VENV_DIR}/bin/python manage.py init_master_db --noinput",
  }

  exec{"init_datasources":
    cwd => '/home/vagrant/treeherder-service',
    command => "${VENV_DIR}/bin/python manage.py init_datasources",
    require => Exec["init_master_db"],
  }

}