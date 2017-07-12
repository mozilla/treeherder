#!/usr/bin/env bash
# Script that is run during Vagrant provision to set up the development environment.

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

if [[ "$(lsb_release -r -s)" != "16.04" ]]; then
    echo "This machine needs to be switched to the new Ubuntu 16.04 image."
    echo "Please run 'vagrant destroy -f && vagrant up' from the host."
    exit 1
fi

SRC_DIR="$HOME/treeherder"
PYTHON_DIR="$HOME/python"

cd "$SRC_DIR"

ELASTICSEARCH_VERSION="5.5.0"
PYTHON_VERSION="$(cat runtime.txt | sed 's/python-//')"
PIP_VERSION="9.0.1"

# Suppress prompts during apt-get invocations.
export DEBIAN_FRONTEND=noninteractive
# Speeds up pip invocations and reduces output spam.
export PIP_DISABLE_PIP_VERSION_CHECK='True'

echo '-----> Configuring .profile and environment variables'
ln -sf "$SRC_DIR/vagrant/.profile" "$HOME/.profile"
sudo ln -sf "$SRC_DIR/vagrant/env.sh" /etc/profile.d/treeherder.sh
. /etc/profile.d/treeherder.sh

# Remove the old MySQL 5.6 PPA repository, if this is an existing Vagrant instance.
sudo rm -f /etc/apt/sources.list.d/ondrej-ubuntu-mysql-5_6-xenial.list

if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]]; then
    echo '-----> Adding APT repository for Node.js'
    curl -sSf https://deb.nodesource.com/gpgkey/nodesource.gpg.key | sudo apt-key add -
    echo 'deb https://deb.nodesource.com/node_7.x xenial main' | sudo tee /etc/apt/sources.list.d/nodesource.list > /dev/null
fi

if [[ ! -f /etc/apt/sources.list.d/yarn.list ]]; then
    echo '-----> Adding APT repository for Yarn'
    curl -sSf https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo 'deb https://dl.yarnpkg.com/debian/ stable main' | sudo tee /etc/apt/sources.list.d/yarn.list > /dev/null
fi

echo '-----> Installing/updating APT packages'
sudo -E apt-get -yqq update
# g++ is required by Brotli
# libmemcached-dev and zlib1g-dev are required by pylibmc
# libmysqlclient-dev is required by mysqlclient
# openjdk-8-jre-headless is required by Elasticsearch
sudo -E apt-get -yqq install --no-install-recommends \
    g++ \
    git \
    libmemcached-dev \
    libmysqlclient-dev \
    memcached \
    mysql-server-5.7 \
    nodejs \
    openjdk-8-jre-headless \
    rabbitmq-server \
    yarn \
    zlib1g-dev

if [[ "$(dpkg-query --show --showformat='${Version}' elasticsearch 2>&1)" != "$ELASTICSEARCH_VERSION" ]]; then
    echo '-----> Installing Elasticsearch'
    curl -sSfo /tmp/elasticsearch.deb "https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-$ELASTICSEARCH_VERSION.deb"
    sudo dpkg -i /tmp/elasticsearch.deb
    # Override the new ES 5.x default minimum heap size of 2GB.
    sudo sed -i 's/.*ES_JAVA_OPTS=.*/ES_JAVA_OPTS="-Xms256m -Xmx1g"/' /etc/default/elasticsearch
    sudo systemctl enable elasticsearch.service 2>&1
    sudo systemctl restart elasticsearch.service
fi

if ! cmp -s vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf; then
    echo '-----> Configuring MySQL'
    sudo cp vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf
    sudo systemctl restart mysql.service
fi

if [[ "$($PYTHON_DIR/bin/python --version 2>&1)" != *"$PYTHON_VERSION" ]]; then
    echo "-----> Installing Python"
    rm -rf "$PYTHON_DIR"
    mkdir -p "$PYTHON_DIR"
    # Uses the Heroku Python buildpack's binaries for parity with production.
    curl -sSf "https://lang-python.s3.amazonaws.com/heroku-16/runtimes/python-$PYTHON_VERSION.tar.gz" | tar -xz -C "$PYTHON_DIR"
    # Work around https://github.com/heroku/heroku-buildpack-python/issues/379
    rm -rf "$PYTHON_DIR/lib/python2.7/site-packages/"*
fi

if [[ "$($PYTHON_DIR/bin/pip --version 2>&1)" != *"$PIP_VERSION"* ]]; then
    echo "-----> Installing pip"
    curl -sSf https://bootstrap.pypa.io/get-pip.py | python - "pip==$PIP_VERSION"
fi

echo '-----> Running pip install'
pip install --require-hashes -r requirements/common.txt -r requirements/dev.txt | sed -e '/^Requirement already satisfied:/d'

echo '-----> Running yarn install'
# We have to use `--no-bin-links` to work around symlink issues with Windows hosts.
# TODO: Switch the flag to a global yarn pref once yarn adds support.
yarn install --no-bin-links

echo '-----> Initialising MySQL database'
# Re-enable blank password root logins, which are disabled by default in MySQL 5.7.
sudo mysql -e 'ALTER USER root@localhost IDENTIFIED WITH mysql_native_password BY ""';
# The default `root@localhost` grant only allows loopback interface connections.
mysql -u root -e 'GRANT ALL PRIVILEGES ON *.* to root@"%"'
mysql -u root -e 'CREATE DATABASE IF NOT EXISTS treeherder'

echo '-----> Waiting for Elasticsearch to be ready'
while ! curl "$ELASTICSEARCH_URL" &> /dev/null; do sleep 1; done

echo '-----> Running Django migrations and loading reference data'
./manage.py migrate --noinput
./manage.py load_initial_data

echo '-----> Performing cleanup'
# Celery sometimes gets stuck and requires that celerybeat-schedule be deleted.
rm -f celerybeat-schedule || true

echo '-----> Setup complete!'
