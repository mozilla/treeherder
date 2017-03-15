class nodejs {

  exec{"yarn-install":
    cwd => "${PROJ_DIR}",
    user => "${APP_USER}",
    # We have to use `--no-bin-links` to work around symlink issues with Windows hosts.
    # TODO: Switch the flag to a global yarn pref once yarn adds support.
    command => "yarn install --no-bin-links",
  }

}
