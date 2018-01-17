#!/usr/bin/env bash

set -euo pipefail

# This script must be sourced, so that the environment variables are set in the calling shell.
export BROKER_URL='amqp://guest:guest@localhost:5672//'
export DATABASE_URL='mysql://root@localhost/test_treeherder'
export ELASTICSEARCH_URL='http://127.0.0.1:9200'
export TREEHERDER_DJANGO_SECRET_KEY='secretkey-of-at-50-characters-to-pass-check-deploy'

setup_services() {
    ELASTICSEARCH_VERSION="5.5.0"
    if [[ "$(dpkg-query --show --showformat='${Version}' elasticsearch 2>&1)" != "$ELASTICSEARCH_VERSION" ]]; then
        echo '-----> Installing Elasticsearch'
        curl -sSfo /tmp/elasticsearch.deb "https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-${ELASTICSEARCH_VERSION}.deb"
        sudo dpkg -i --force-confold /tmp/elasticsearch.deb
        sudo service elasticsearch restart
    else
        sudo service elasticsearch start
    fi

    # Using tmpfs for the MySQL data directory reduces pytest runtime by 30%.
    echo '-----> Creating RAM disk for MySQL'
    sudo stop mysql
    sudo mkdir /mnt/ramdisk
    sudo mount -t tmpfs -o size=1024m tmpfs /mnt/ramdisk
    sudo mv /var/lib/mysql /mnt/ramdisk
    sudo ln -s /mnt/ramdisk/mysql /var/lib/mysql

    echo '-----> Installing MySQL'
    sudo cp vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf
    # Use the upstream APT repo since the latest Ubuntu trusty package is MySQL 5.6.
    echo 'deb http://repo.mysql.com/apt/ubuntu/ trusty mysql-5.7' | sudo tee /etc/apt/sources.list.d/mysql.list > /dev/null
    sudo -E apt-get -yqq update
    sudo -E apt-get -yqq install --no-install-recommends --allow-unauthenticated mysql-server libmysqlclient-dev

    echo '-----> Starting redis-server'
    sudo service redis-server start

    echo '-----> Starting rabbitmq-server'
    sudo service rabbitmq-server start

    echo '-----> Waiting for Elasticsearch to be ready'
    while ! curl "${ELASTICSEARCH_URL}" &> /dev/null; do sleep 1; done
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
    pip install -r requirements/docs.txt
}

setup_geckodriver() {
    echo '-----> Installing geckodriver'
    curl -sSfL 'https://github.com/mozilla/geckodriver/releases/download/v0.19.1/geckodriver-v0.19.1-linux64.tar.gz' | tar -zxC "${HOME}/bin"
}

setup_js_env() {
    echo '-----> Installing Firefox'
    curl -sSfL 'https://download.mozilla.org/?product=firefox-beta-latest&lang=en-US&os=linux64' | tar -jxC "${HOME}"
    export PATH="${HOME}/firefox:${PATH}"
    # Enable Firefox headless mode, avoiding the need for xvfb.
    export MOZ_HEADLESS=1

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
