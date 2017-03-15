class python {

  exec{"pip-install":
    require => [
      Exec['vendor-libmysqlclient'],
    ],
    user => "${APP_USER}",
    cwd => "${PROJ_DIR}",
    command => "pip install --disable-pip-version-check --require-hashes -r requirements/common.txt -r requirements/dev.txt",
    timeout => 1800,
  }

}
