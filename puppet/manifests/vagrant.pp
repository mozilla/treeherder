#
# Playdoh puppet magic for dev boxes
#
import "classes/*.pp"

$PROJ_DIR = "/home/vagrant/treeherder-service"

# You can make these less generic if you like, but these are box-specific
# so it's not required.
$DB_NAME = "treeherder"
$DB_USER = "treeherder_user"
$DB_PASS = "treeherder_pass"
$DB_HOST = "localhost"
$DB_PORT = "3306"
$DJANGO_SECRET_KEY = "5up3r53cr3t"
$RABBITMQ_USER = 'rabbituser'
$RABBITMQ_PASSWORD = 'rabbitpass'
$RABBITMQ_VHOST = 'treeherder'
$RABBITMQ_HOST = 'localhost'
$RABBITMQ_PORT = '5672'

Exec {
    path => "/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin",
}

file {"/etc/profile.d/treeherder.sh":
    content => "
export TREEHERDER_DATABASE_NAME='${DB_NAME}'
export TREEHERDER_DATABASE_USER='${DB_USER}'
export TREEHERDER_DATABASE_PASSWORD='${DB_PASS}'
export TREEHERDER_DATABASE_HOST='${DB_HOST}'
export TREEHERDER_DATABASE_PORT='${DB_PORT}'
export TREEHERDER_DEBUG='1'
export TREEHERDER_DJANGO_SECRET_KEY='${DJANGO_SECRET_KEY}'
export TREEHERDER_MEMCACHED='127.0.0.1:11211'
export TREEHERDER_RABBITMQ_USER='${RABBITMQ_USER}'
export TREEHERDER_RABBITMQ_PASSWORD='${RABBITMQ_PASSWORD}'
export TREEHERDER_RABBITMQ_VHOST='${RABBITMQ_VHOST}'
export TREEHERDER_RABBITMQ_HOST='${RABBITMQ_HOST}'
export TREEHERDER_RABBITMQ_PORT='${RABBITMQ_PORT}'
"
}

class dev {
    class {
        init: before => Class[mysql];
        mysql: before  => Class[python];
        python: before => Class[apache];
        apache: before => Class[treeherder];
        treeherder: before => Class[rabbitmq];
        rabbitmq:;
    }
}

include dev
