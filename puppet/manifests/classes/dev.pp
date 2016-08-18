class dev{
  exec{"migrate":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ./manage.py migrate --noinput'",
    user => "${APP_USER}",
  }

  exec{"load_initial_data":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ./manage.py load_initial_data'",
    require => Exec["migrate"],
    user => "${APP_USER}",
  }

  exec{"init_datasources":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ./manage.py init_datasources'",
    require => Exec["load_initial_data"],
    user => "${APP_USER}",
  }
}
