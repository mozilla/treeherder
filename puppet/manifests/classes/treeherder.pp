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

    exec {"treeherder-help-text":
      unless => "grep 'echo ${THELP_TEXT}' ${HOME_DIR}/.bashrc",
      command => "echo 'echo ${THELP_TEXT}' >> ${HOME_DIR}/.bashrc",
      user => "${APP_USER}",
    }

    exec {"cd-treeherder-on-login":
      unless => "grep 'cd ${PROJ_DIR}' ${HOME_DIR}/.bashrc",
      command => "echo 'cd ${PROJ_DIR}' >> ${HOME_DIR}/.bashrc",
      user => "${APP_USER}",
    }

    exec {"vagrant-prompt":
      unless =>  "grep -F 'export PS1=\"${PS1}\"' ${HOME_DIR}/.bashrc",
      command => "echo 'export PS1=\"${PS1}\"' >> ${HOME_DIR}/.bashrc",
      user => "${APP_USER}",
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
