#!/usr/bin/env bash
# Script that is run during Vagrant provision to set up the development environment.

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

SRC_DIR="$HOME/treeherder"
VENV_DIR="$HOME/venv"
ELASTICSEARCH_VERSION="2.3.5"

export PATH="$VENV_DIR/bin:$PATH"
# Suppress prompts during apt-get invocations.
export DEBIAN_FRONTEND=noninteractive
# Speeds up pip invocations and reduces output spam.
export PIP_DISABLE_PIP_VERSION_CHECK='True'

cd "$SRC_DIR"

echo '-----> Configuring .profile and environment variables'
ln -sf "$SRC_DIR/vagrant/.profile" "$HOME/.profile"
sudo ln -sf "$SRC_DIR/vagrant/env.sh" /etc/profile.d/treeherder.sh
. /etc/profile.d/treeherder.sh

if [[ ! -f /etc/apt/sources.list.d/fkrull-deadsnakes-python2_7-trusty.list ]]; then
    echo '-----> Adding APT repository for Python 2.7'
    sudo add-apt-repository -y ppa:fkrull/deadsnakes-python2.7 2>&1
fi

if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]]; then
    echo '-----> Adding APT repository for Node.js'
    curl -sSf https://deb.nodesource.com/gpgkey/nodesource.gpg.key | sudo apt-key add -
    echo 'deb https://deb.nodesource.com/node_7.x trusty main' | sudo tee /etc/apt/sources.list.d/nodesource.list > /dev/null
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
# openjdk-7-jre-headless is required by Elasticsearch
# python-dev is required by mysqlclient
sudo -E apt-get -yqq install --no-install-recommends \
    g++ \
    git \
    libmemcached-dev \
    memcached \
    mysql-server-5.6 \
    nodejs \
    openjdk-7-jre-headless \
    python2.7 \
    python2.7-dev \
    rabbitmq-server \
    varnish \
    yarn \
    zlib1g-dev

if [[ "$(dpkg-query --show --showformat='${Version}' elasticsearch 2>&1)" != "$ELASTICSEARCH_VERSION" ]]; then
    echo '-----> Installing Elasticsearch'
    curl -sSfo /tmp/elasticsearch.deb "https://download.elastic.co/elasticsearch/release/org/elasticsearch/distribution/deb/elasticsearch/$ELASTICSEARCH_VERSION/elasticsearch-$ELASTICSEARCH_VERSION.deb"
    sudo dpkg -i /tmp/elasticsearch.deb
    sudo update-rc.d elasticsearch defaults 95 10
    sudo service elasticsearch start
fi

if ! cmp -s vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf; then
    echo '-----> Configuring MySQL'
    sudo cp vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf
    sudo service mysql restart
fi

if ! (cmp -s vagrant/varnish.vcl /etc/varnish/default.vcl && grep -q 'DAEMON_OPTS=\"-a :80' /etc/default/varnish); then
    echo '-----> Configuring Varnish'
    sudo sed -i '/^DAEMON_OPTS=\"-a :6081* / s/6081/80/' /etc/default/varnish
    sudo cp vagrant/varnish.vcl /etc/varnish/default.vcl
    sudo service varnish restart
fi

if [[ ! -f /usr/local/bin/pip ]]; then
    echo '-----> Installing pip'
    curl -sSf https://bootstrap.pypa.io/get-pip.py | sudo -H python -
fi

if [[ ! -f /usr/local/bin/virtualenv ]]; then
    echo '-----> Installing virtualenv'
    sudo -H pip install virtualenv==15.0.1
fi

if [[ ! -d "$VENV_DIR" ]]; then
    echo '-----> Creating virtualenv'
    virtualenv "$VENV_DIR"
fi

./bin/vendor-libmysqlclient.sh "$VENV_DIR"

echo '-----> Running pip install'
pip install --require-hashes -r requirements/common.txt -r requirements/dev.txt | sed -e '/^Requirement already satisfied:/d'

echo '-----> Running yarn install'
# We have to use `--no-bin-links` to work around symlink issues with Windows hosts.
# TODO: Switch the flag to a global yarn pref once yarn adds support.
yarn install --no-bin-links

echo '-----> Initialising MySQL database'
# The default `root@localhost` grant only allows loopback interface connections.
mysql -u root -e 'GRANT ALL PRIVILEGES ON *.* to root@"%"'
mysql -u root -e 'CREATE DATABASE IF NOT EXISTS treeherder'

echo '-----> Running Django migrations and loading reference data'
./manage.py migrate --noinput
./manage.py load_initial_data
