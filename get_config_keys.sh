#!/bin/sh

set -eu

main() {
    heroku config -a treeherder-prototype | grep "$1"
    heroku config -a treeherder-stage | grep "$1"
    heroku config -a treeherder-prod | grep "$1"
}

main "$@"
