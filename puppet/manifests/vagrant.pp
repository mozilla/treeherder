# Playdoh puppet magic for dev boxes
import "classes/*.pp"

$APP_USER="vagrant"
$APP_GROUP="vagrant"
$HOME_DIR = "/home/${APP_USER}"
$PROJ_DIR = "${HOME_DIR}/treeherder"
$VENV_DIR = "${HOME_DIR}/venv"
$PS1 = '\[\e[0;31m\]\u\[\e[m\] \[\e[1;34m\]\w\[\e[m\] \$ '
$THELP_TEXT = 'Type \\"thelp\\" to see a list of Treeherder-specific helper aliases'

Exec {
    path => "${VENV_DIR}/bin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin",
}

line {"etc-hosts":
  file => "/etc/hosts",
  line => "127.0.0.1 local.treeherder.mozilla.org",
  ensure => "present"
}

file {"/etc/profile.d/treeherder.sh":
    ensure => "link",
    target => "${PROJ_DIR}/puppet/files/treeherder/env.sh",
}

file {"/var/log/treeherder/":
    ensure => "directory",
    owner => "vagrant",
    group => "adm",
    mode => 750,
}

file {"${PROJ_DIR}/treeherder/config/settings_local.py":
     replace => "no",
     content => template("${PROJ_DIR}/puppet/files/treeherder/local.vagrant.py"),
}

class vagrant {
    class {
        init: before => Class["mysql"];
        mysql: before  => Class["elasticsearch"];
        elasticsearch: before  => Class["python"];
        python: before => Class["varnish"];
        varnish: before => Class["treeherder"];
        treeherder: before => Class["rabbitmq"];
        rabbitmq: before => Class["dev"];
        dev:;
    }
}

include vagrant
