#!/usr/bin/env bash

# Script that is run during Vagrant provision to set up the development environment.
# TODO: Switch from Vagrant to a docker/docker-compose based environment (bug 1169263).

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

if [[ "$(lsb_release -r -s)" != "18.04" ]]; then
    echo "This machine needs to be switched to the new Ubuntu 18.04 image."
    echo "Please run 'vagrant destroy -f && vagrant up --provision' from the host."
    exit 1
fi

SRC_DIR="$HOME/treeherder"
PYTHON_DIR="$HOME/python"

cd "$SRC_DIR"

GECKODRIVER_VERSION="0.24.0"
PYTHON_VERSION="$(sed 's/python-//' runtime.txt)"
PIP_VERSION="19.0.2"
# Keep in sync with the version pre-installed on Travis.
# https://github.com/travis-ci/travis-cookbooks/blob/9595f0a5316a2bc9b15f1e8a07e58cd07b97167c/cookbooks/travis_build_environment/attributes/default.rb#L267-L270
SHELLCHECK_VERSION="0.6.0"

# Suppress prompts during apt-get invocations.
export DEBIAN_FRONTEND=noninteractive
# Speeds up pip invocations and reduces output spam.
export PIP_DISABLE_PIP_VERSION_CHECK='True'

echo '-----> Performing cleanup'
# Stale pyc files can cause pytest ImportMismatchError exceptions.
find . -type f -name '*.pyc' -delete
# Celery sometimes gets stuck and requires that celerybeat-schedule be deleted.
rm -f celerybeat-schedule

echo '-----> Configuring .profile and environment variables'
ln -sf "$SRC_DIR/vagrant/.profile" "$HOME/.profile"
sudo ln -sf "$SRC_DIR/vagrant/env.sh" /etc/profile.d/treeherder.sh
. vagrant/env.sh

if ! grep -qs 'node_11.x' /etc/apt/sources.list.d/nodesource.list; then
    echo '-----> Adding APT repository for Node.js'
    sudo curl -sSf https://deb.nodesource.com/gpgkey/nodesource.gpg.key -o /etc/apt/trusted.gpg.d/nodesource.asc
    echo 'deb https://deb.nodesource.com/node_11.x bionic main' | sudo tee /etc/apt/sources.list.d/nodesource.list > /dev/null
fi

if [[ ! -f /etc/apt/sources.list.d/yarn.list ]]; then
    echo '-----> Adding APT repository for Yarn'
    sudo curl -sSf https://dl.yarnpkg.com/debian/pubkey.gpg -o /etc/apt/trusted.gpg.d/yarn.asc
    echo 'deb https://dl.yarnpkg.com/debian/ stable main' | sudo tee /etc/apt/sources.list.d/yarn.list > /dev/null
fi

echo '-----> Installing/updating APT packages'
sudo -E apt-get -yqq update
sudo -E apt-get -yqq -o 'Dpkg::Options::=--force-confnew' dist-upgrade
# libdbus-glib-1-2, libgtk-3.0 and libxt6 are required by Firefox
# gcc and libmysqlclient-dev are required by mysqlclient
sudo -E apt-get -yqq install --no-install-recommends \
    gcc \
    libdbus-glib-1-2 \
    libgtk-3.0 \
    libmysqlclient-dev \
    libxt6 \
    mysql-server-5.7 \
    nodejs \
    rabbitmq-server \
    redis-server \
    yarn

if ! cmp -s vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf; then
    echo '-----> Configuring MySQL'
    sudo cp vagrant/mysql.cnf /etc/mysql/conf.d/treeherder.cnf
    sudo systemctl restart mysql.service
fi

if [[ "$("${PYTHON_DIR}/bin/python" --version 2>&1)" != *"$PYTHON_VERSION" ]]; then
    echo "-----> Installing Python"
    rm -rf "$PYTHON_DIR"
    mkdir -p "$PYTHON_DIR"
    # Uses the Heroku Python buildpack's binaries for parity with production.
    curl -sSf "https://lang-python.s3.amazonaws.com/heroku-18/runtimes/python-$PYTHON_VERSION.tar.gz" | tar -xz -C "$PYTHON_DIR"
fi

if [[ "$("${PYTHON_DIR}/bin/pip" --version 2>&1)" != *"$PIP_VERSION"* ]]; then
    echo "-----> Installing pip"
    curl -sSf https://bootstrap.pypa.io/get-pip.py | python - "pip==$PIP_VERSION"
fi

echo '-----> Running pip install'
pip install --require-hashes -r requirements/common.txt -r requirements/dev.txt \
    | sed -e '/^Requirement already satisfied:/d'
# Installing separately since we don't specify sub-deps and hashes for docs dependencies.
pip install -r requirements/docs.txt \
    | sed -e '/^Requirement already satisfied:/d'

if [[ "$(geckodriver --version 2>&1)" != *"${GECKODRIVER_VERSION}"* ]]; then
    echo '-----> Installing geckodriver'
    curl -sSfL "https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz" \
        | sudo tar -zxC /usr/local/bin
fi

echo '-----> Installing Firefox'
curl -sSfL 'https://download.mozilla.org/?product=firefox-beta-latest&lang=en-US&os=linux64' | sudo tar -jxC "${HOME}"

echo '-----> Running yarn install'
yarn install

if [[ "$(shellcheck --version 2>&1)" != *"version: ${SHELLCHECK_VERSION}"* ]]; then
    echo '-----> Installing shellcheck'
    curl -sSfL "https://storage.googleapis.com/shellcheck/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz" \
        | sudo tar -Jx --strip-components=1 -C /usr/local/bin
fi

echo '-----> Initialising MySQL database'
# Re-enable blank password root logins, which are disabled by default in MySQL 5.7.
sudo mysql -e 'ALTER USER root@localhost IDENTIFIED WITH mysql_native_password BY ""';
# The default `root@localhost` grant only allows loopback interface connections.
mysql -u root -e 'GRANT ALL PRIVILEGES ON *.* to root@"%"'
mysql -u root -e 'CREATE DATABASE IF NOT EXISTS treeherder'

echo '-----> Running Django migrations and loading reference data'
./manage.py migrate --noinput
./manage.py load_initial_data

echo '-----> Setup complete!'
