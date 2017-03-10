class nodejs {

  package { 'nodejs':
    # Heroku/Travis pin to a specific point release, but that's not possible
    # with apt-get due to https://github.com/nodesource/distributions/issues/33,
    # and using the .deb has it's own set of issues, so let's not bother for now.
    # In this case `latest` means latest 7.x.x release, and should be fairly safe.
    ensure => latest,
  }

  package { 'yarn':
    # Not pinning to a specific version for parity with Travis, and since yarn
    # is rapidly releasing so would require continually incrementing.
    ensure  => latest,
    require => Package['nodejs'],
  }

  exec{"yarn-install":
    cwd => "${PROJ_DIR}",
    user => "${APP_USER}",
    # We have to use `--no-bin-links` to work around symlink issues with Windows hosts.
    # TODO: Switch the flag to a global yarn pref once yarn adds support.
    command => "yarn install --no-bin-links",
    require => Package['yarn'],
  }

}
