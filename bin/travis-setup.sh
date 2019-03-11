#!/usr/bin/env bash

# Script that is called from `.travis.yml` to bootstrap the Travis environment.
# TODO: Use docker in CI instead as part of the move from Vagrant to docker (bug 1169263).

set -euo pipefail

# This script must be sourced, so that the environment variables are set in the calling shell.
export BROKER_URL='amqp://guest:guest@localhost:5672//'
export DATABASE_URL='mysql://root@localhost/test_treeherder'
export REDIS_URL='redis://localhost:6379'
export TREEHERDER_DJANGO_SECRET_KEY='secretkey-of-at-50-characters-to-pass-check-deploy'

setup_services() {
    echo '-----> Running apt-get update'
    sudo apt-get update

    echo '-----> Installing RabbitMQ'
    sudo apt-get install --no-install-recommends rabbitmq-server

    echo '-----> Configuring MySQL'
    # Using tmpfs for the MySQL data directory reduces pytest runtime by 30%.
    sudo mkdir /mnt/ramdisk
    sudo mount -t tmpfs -o size=1024m tmpfs /mnt/ramdisk
    sudo mv /var/lib/mysql /mnt/ramdisk
    sudo ln -s /mnt/ramdisk/mysql /var/lib/mysql
    sudo cp vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf
    sudo systemctl start mysql

    echo '-----> Starting redis-server'
    sudo systemctl start redis-server
}

setup_python_env() {
    # Use a clean virtualenv rather than the one given to us, to work around:
    # https://github.com/travis-ci/travis-ci/issues/4873
    if [[ ! -f "${HOME}/venv/bin/python" ]]; then
        echo '-----> Creating virtualenv'
        virtualenv -p python "${HOME}/venv"
    fi
    export PATH="${HOME}/venv/bin:${PATH}"

    echo '-----> Running pip install'
    pip install --require-hashes -r requirements/common.txt -r requirements/dev.txt
}

setup_docs() {
    pip install -U -r requirements/docs.txt
}

setup_browser() {
    echo '-----> Installing geckodriver'
    GECKODRIVER_VERSION='0.24.0'
    curl -sSfL "https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz" \
        | tar -zxC "${HOME}/bin"

    echo '-----> Installing Firefox'
    curl -sSfL 'https://download.mozilla.org/?product=firefox-beta-latest&lang=en-US&os=linux64' | tar -jxC "${HOME}"
    export PATH="${HOME}/firefox:${PATH}"
    # Enable Firefox headless mode, avoiding the need for xvfb.
    export MOZ_HEADLESS=1
}

setup_js_env() {
    echo '-----> Installing yarn'
    YARN_VERSION=$(jq -r '.engines.yarn' package.json)
    curl -sSfL "https://yarnpkg.com/downloads/${YARN_VERSION}/yarn-v${YARN_VERSION}.tar.gz" \
        | tar -zxC "${HOME}" --strip=1

    echo '-----> Running yarn install'
    # `--frozen-lockfile` will catch cases where people have forgotten to update `yarn.lock`.
    yarn install --frozen-lockfile
}

for task in "$@"; do
    "setup_${task}"
done

# Restore shell options since this script is sourced, so affects the caller:
# https://github.com/travis-ci/travis-ci/issues/5434
set +euo pipefail
