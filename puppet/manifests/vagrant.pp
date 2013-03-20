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
"
}

class dev {
    class {
        init: before => Class[mysql];
        mysql: before  => Class[python];
        python: before => Class[apache];
        apache: before => Class[treeherder];
        treeherder: ;
    }
}

include dev
