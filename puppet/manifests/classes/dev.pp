# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

class dev{
  exec{"peep-install-dev":
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/python ${PROJ_DIR}/bin/peep.py install -r ${PROJ_DIR}/requirements/dev.txt",
    timeout => 1800,
  }

  exec{"init_master_db":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py init_master_db --noinput'",
    user => "${APP_USER}",
  }

  exec{"init_datasources":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py init_datasources'",
    require => Exec["init_master_db"],
    user => "${APP_USER}",
  }

  exec{"export_project_credentials":
    cwd => "${PROJ_DIR}",
    command => "bash -c 'source /etc/profile.d/treeherder.sh; ${VENV_DIR}/bin/python manage.py export_project_credentials'",
    require => Exec["init_datasources"],
    user => "${APP_USER}",
  }
}
