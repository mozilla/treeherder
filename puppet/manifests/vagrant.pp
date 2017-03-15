# Playdoh puppet magic for dev boxes
import "classes/*.pp"

$APP_USER="vagrant"
$APP_GROUP="vagrant"
$HOME_DIR = "/home/${APP_USER}"
$PROJ_DIR = "${HOME_DIR}/treeherder"
$VENV_DIR = "${HOME_DIR}/venv"

Exec {
    path => "${VENV_DIR}/bin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin",
}
