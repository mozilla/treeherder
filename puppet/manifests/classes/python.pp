# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

# Install python and compiled modules for project

$python_devel = $operatingsystem ? {
    ubuntu => "python-dev",
    default => "python-devel",
}

$libxml2 = $operatingsystem ? {
    ubuntu => "libxml2-dev",
    default => "libxml2-devel",
}

$site_packages = $operatingsystem ? {
    ubuntu => "lib/python2.7/site-packages",
    default => "lib64/python2.7/site-packages",
}

class python {

  package{[$python_devel,
           "gcc",
           "python-setuptools",
           "python-pip",
           "python-virtualenv",
           "git",
           $libxml2]:
    ensure => installed;
  }

  exec {
    "create-virtualenv":
    cwd => "/home/${APP_USER}",
    user => "${APP_USER}",
    command => "virtualenv --no-site-packages ${VENV_DIR}",
    creates => "${VENV_DIR}",
    require => Package["python-virtualenv"],
  }

  exec {"activate-venv-on-login":
    unless => "cat /home/${APP_USER}/.bashrc | grep 'source venv/bin/activate'",
    command => "echo 'source venv/bin/activate' >> /home/${APP_USER}/.bashrc",
    require => Exec["create-virtualenv"],
    user => "${APP_USER}",
  }

  exec{"pip-install-compiled":
    require => [
      Exec['create-virtualenv'],
      File[ "/home/${APP_USER}/pip_cache"],
      Exec['update-distribute']
    ],
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/pip install --download-cache=/home/${APP_USER}/pip_cache -r ${PROJ_DIR}/requirements/compiled.txt",
    timeout => 1800,
  }

  file {"/home/${APP_USER}/pip_cache":
    ensure => directory,
    owner  => "${APP_USER}",
    group  => "${APP_GROUP}",
  }

  file { "vendor.pth":
    path => "${VENV_DIR}/${site_packages}/vendor.pth",
    ensure => present,
    content => "$PROJ_DIR/vendor/",
    require => Exec["create-virtualenv"],
  }

  exec { "update-distribute":
        command => "${VENV_DIR}/bin/pip install --upgrade distribute",
        require => [
            Package['python-pip'],
            Exec['create-virtualenv']
        ]
    }

}
