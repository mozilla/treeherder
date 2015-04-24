# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

# Install python and common packages for project

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

  # Python2.7 is already installed, but we need to update it to the
  # latest version from the third party PPA.
  package{["python2.7",
           $python_devel,
           "gcc",
           "curl",
           "git",
           $libxml2]:
    ensure => "latest",
  }

  exec { "install-pip":
    cwd => "/tmp",
    user => "${APP_USER}",
    command => "curl https://bootstrap.pypa.io/get-pip.py | sudo python -",
    creates => "/usr/local/bin/pip",
    require => [
      Package[curl],
      Package[$python_devel],
    ],
  }

  exec { "install-virtualenv":
    cwd => "/tmp",
    user => "${APP_USER}",
    command => "sudo pip install virtualenv==12.0.7",
    creates => "/usr/local/bin/virtualenv",
    require => Exec["install-pip"],
  }

  exec {
    "create-virtualenv":
    cwd => "/home/${APP_USER}",
    user => "${APP_USER}",
    command => "virtualenv ${VENV_DIR}",
    creates => "${VENV_DIR}",
    require => Exec["install-virtualenv"],
  }

  exec {"activate-venv-on-login":
    unless => "cat /home/${APP_USER}/.bashrc | grep 'source venv/bin/activate'",
    command => "echo 'source venv/bin/activate' >> /home/${APP_USER}/.bashrc",
    require => Exec["create-virtualenv"],
    user => "${APP_USER}",
  }

  exec{"peep-install-common":
    require => Exec['create-virtualenv'],
    user => "${APP_USER}",
    cwd => '/tmp',
    command => "${VENV_DIR}/bin/python ${PROJ_DIR}/bin/peep.py install -r ${PROJ_DIR}/requirements/common.txt",
    timeout => 1800,
  }

}
