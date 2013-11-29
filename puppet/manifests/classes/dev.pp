class dev{
  exec{"pip-install-dev":
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/pip install --download-cache=/home/${APP_USER}/pip_cache -r ${PROJ_DIR}/requirements/dev.txt",
    timeout => 1800,
  }

}