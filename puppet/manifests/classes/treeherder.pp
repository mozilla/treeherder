# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

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

    exec {"cd-treeherder-on-login":
      unless => "grep 'cd ${PROJ_DIR}' ${HOME_DIR}/.bashrc",
      command => "echo 'cd ${PROJ_DIR}' >> ${HOME_DIR}/.bashrc",
      user => "${APP_USER}",
    }

    exec {"copy-aliases":
      command => "cp ${PROJ_DIR}/puppet/files/treeherder/.bash_aliases ${HOME_DIR}",
      user => "${APP_USER}",
    }

    exec {"source-aliases-on-login":
      unless => "grep 'source ${HOME_DIR}/.bash_aliases' ${HOME_DIR}/.bashrc",
      command => "echo 'source ${HOME_DIR}/.bash_aliases' >> ${HOME_DIR}/.bashrc",
      user => "${APP_USER}",
    }

    exec{"build-extensions":
      command => "${VENV_DIR}/bin/python ${PROJ_DIR}/setup.py build_ext --inplace",
      user => "${APP_USER}",
      cwd => "${PROJ_DIR}",
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
