#any additional stuff goes here
class treeherder {
    package{"make":
        ensure => "installed"
    }

    package{"memcached":
        ensure => "installed"
    }

    service{"memcached":
        ensure => running,
        enable => true,
        require => Package['memcached'],
    }

    exec{"build-extensions":
      command => "${VENV_DIR}/bin/python ${PROJ_DIR}/setup.py build_ext --inplace"
    }

    file { [
      "/var/log/gunicorn",
      "/var/log/celery",
      "/var/log/socketio"
      ]:
      ensure => "directory",
      owner  => "${APP_USER}",
      group  => "${APP_GROUP}",
      mode   => 755,
    }
}
