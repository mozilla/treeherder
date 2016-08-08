# Playdoh puppet magic for dev boxes
import "classes/*.pp"

$APP_USER="vagrant"
$APP_GROUP="vagrant"
$HOME_DIR = "/home/${APP_USER}"
$PROJ_DIR = "${HOME_DIR}/treeherder"
$VENV_DIR = "${HOME_DIR}/venv"
$PS1 = '\[\e[0;31m\]\u\[\e[m\] \[\e[1;34m\]\w\[\e[m\] \$ '
$THELP_TEXT = 'Type \\"thelp\\" to see a list of Treeherder-specific helper aliases'

# You can make these less generic if you like, but these are box-specific
# so it's not required.
$DB_USER = "treeherder_user"
$DB_PASS = "treeherder_pass"
$DJANGO_SECRET_KEY = "secret-key-of-at-least-50-characters-to-pass-check-deploy"
$RABBITMQ_USER = 'guest'
$RABBITMQ_PASSWORD = 'guest'
$RABBITMQ_VHOST = '/'

Exec {
    path => "${VENV_DIR}/bin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin",
}

line {"etc-hosts":
  file => "/etc/hosts",
  line => "127.0.0.1 local.treeherder.mozilla.org",
  ensure => "present"
}

file {"/etc/profile.d/treeherder.sh":
    content => "
# Ensure the vendored libmysqlclient library can be found at run-time.
export LD_LIBRARY_PATH='${VENV_DIR}/lib/x86_64-linux-gnu'

export ENABLE_LOCAL_SETTINGS_FILE='True'
export BROKER_URL='amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@localhost:5672/${RABBITMQ_VHOST}'
export DATABASE_URL='mysql://${DB_USER}:${DB_PASS}@localhost/treeherder'
export DATABASE_URL_RO='mysql://${DB_USER}:${DB_PASS}@localhost/treeherder'
export ELASTICSEARCH_URL='http://localhost:9200'

export TREEHERDER_DEBUG='True'
export ENABLE_DEBUG_TOOLBAR='True'
export TREEHERDER_DJANGO_SECRET_KEY='${DJANGO_SECRET_KEY}'
export NEW_RELIC_DEVELOPER_MODE='True'
"
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
