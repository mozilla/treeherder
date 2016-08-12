#any additional stuff goes here
class treeherder {
    package{"memcached":
        ensure => "installed"
    }

    service{"memcached":
        ensure => running,
        enable => true,
        require => Package['memcached'],
    }

    # Restore the default .bashrc to undo any customisations made before we
    # moved them to .profile instead. This can be removed in a few weeks.
    file {"$HOME_DIR/.bashrc":
      source => "/etc/skel/.bashrc",
      owner => "${APP_USER}",
      group  => "${APP_GROUP}",
    }

    file {"$HOME_DIR/.profile":
      ensure => "link",
      target => "${PROJ_DIR}/puppet/files/treeherder/.profile",
      owner => "${APP_USER}",
      group  => "${APP_GROUP}",
    }

    file { [
      "/var/log/gunicorn",
      "/var/log/celery",
      ]:
      ensure => "directory",
      owner  => "${APP_USER}",
      group  => "${APP_GROUP}",
      mode   => 755,
    }
}
