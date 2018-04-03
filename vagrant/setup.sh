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

ELASTICSEARCH_VERSION="6.2.4"
GECKODRIVER_VERSION="0.20.0"
PYTHON_VERSION="$(sed 's/python-//' runtime.txt)"
PIP_VERSION="9.0.1"
# Keep in sync with the version pre-installed on Travis.
SHELLCHECK_VERSION="0.4.7"

# Suppress prompts during apt-get invocations.
export DEBIAN_FRONTEND=noninteractive
# Speeds up pip invocations and reduces output spam.
export PIP_DISABLE_PIP_VERSION_CHECK='True'

echo '-----> Performing cleanup'
# Remove the old MySQL 5.6 PPA repository, if this is an existing Vagrant instance.
sudo rm -f /etc/apt/sources.list.d/ondrej-ubuntu-mysql-5_6-xenial.list
# Remove memcached remnants in case this instance existed prior to the Redis switch.
sudo -E apt-get -yqq purge --auto-remove memcached libmemcached-dev
# Stale pyc files can cause pytest ImportMismatchError exceptions.
find . -type f -name '*.pyc' -delete
# Celery sometimes gets stuck and requires that celerybeat-schedule be deleted.
rm -f celerybeat-schedule

echo '-----> Configuring .profile and environment variables'
ln -sf "$SRC_DIR/vagrant/.profile" "$HOME/.profile"
sudo ln -sf "$SRC_DIR/vagrant/env.sh" /etc/profile.d/treeherder.sh
. vagrant/env.sh

if ! grep -qs 'node_8.x' /etc/apt/sources.list.d/nodesource.list; then
    echo '-----> Adding APT repository for Node.js'
    curl -sSf https://deb.nodesource.com/gpgkey/nodesource.gpg.key | sudo apt-key add -
    echo 'deb https://deb.nodesource.com/node_8.x xenial main' | sudo tee /etc/apt/sources.list.d/nodesource.list > /dev/null
fi

if [[ ! -f /etc/apt/sources.list.d/yarn.list ]]; then
    echo '-----> Adding APT repository for Yarn'
    curl -sSf https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo 'deb https://dl.yarnpkg.com/debian/ stable main' | sudo tee /etc/apt/sources.list.d/yarn.list > /dev/null
fi

echo '-----> Installing/updating APT packages'
sudo -E apt-get -yqq update
sudo -E apt-get -yqq dist-upgrade
# libgtk-3.0 and libxt-dev are required by Firefox
# libmysqlclient-dev is required by mysqlclient
# openjdk-8-jre-headless is required by Elasticsearch
sudo -E apt-get -yqq install --no-install-recommends \
    libgtk-3.0 \
    libmysqlclient-dev \
    libxt-dev \
    mysql-server-5.7 \
    nodejs \
    openjdk-8-jre-headless \
    rabbitmq-server \
    redis-server \
    yarn

if [[ "$(dpkg-query --show --showformat='${Version}' elasticsearch 2>&1)" != "$ELASTICSEARCH_VERSION" ]]; then
    echo '-----> Installing Elasticsearch'
    curl -sSfo /tmp/elasticsearch.deb "https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-$ELASTICSEARCH_VERSION.deb"
    sudo dpkg -i --force-confnew /tmp/elasticsearch.deb
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

if [[ "$("${PYTHON_DIR}/bin/python" --version 2>&1)" != *"$PYTHON_VERSION" ]]; then
    echo "-----> Installing Python"
    rm -rf "$PYTHON_DIR"
    mkdir -p "$PYTHON_DIR"
    # Uses the Heroku Python buildpack's binaries for parity with production.
    curl -sSf "https://lang-python.s3.amazonaws.com/heroku-16/runtimes/python-$PYTHON_VERSION.tar.gz" | tar -xz -C "$PYTHON_DIR"
fi

if [[ "$("${PYTHON_DIR}/bin/pip" --version 2>&1)" != *"$PIP_VERSION"* ]]; then
    echo "-----> Installing pip"
    curl -sSf https://bootstrap.pypa.io/get-pip.py | python - "pip==$PIP_VERSION"
fi

echo '-----> Running pip install'
# The harmless 'Ignoring PACKAGE' lines are filtered out to prevent them from causing
# confusion due to being shown in red. Remove once using a pip that includes a fix for:
# https://github.com/pypa/pip/issues/4876
pip install --require-hashes -r requirements/common.txt -r requirements/dev.txt \
    |& sed -r '/^(Requirement already satisfied:|Ignoring )/d'

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

echo '-----> Waiting for Elasticsearch to be ready'
while ! curl "$ELASTICSEARCH_URL" &> /dev/null; do sleep 1; done

echo '-----> Installing Postgres'
PG_VERSION=10

PG_REPO_APT_SOURCE=/etc/apt/sources.list.d/pgdg.list
if [ ! -f "$PG_REPO_APT_SOURCE" ]; then
  # Add PG apt repo:
  echo "deb http://apt.postgresql.org/pub/repos/apt/ xenial-pgdg main" | sudo tee "$PG_REPO_APT_SOURCE"

  # Add PGDG repo key:
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
fi
sudo -E apt-get -yqq update
sudo -E apt-get -yqq install "postgresql-$PG_VERSION" "postgresql-contrib-$PG_VERSION"

echo '-----> Configuring PostgreSQL'
# Edit the following to change the version of PostgreSQL that is installed
PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Edit postgresql.conf to change listen address to '*':
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"

# Append to pg_hba.conf to add password auth:
echo "host    all             all             all                     md5" | sudo tee -a "$PG_HBA"

# Explicitly set default client_encoding
echo "client_encoding = utf8" | sudo tee -a "$PG_CONF"

# Restart so that all new config is loaded:
sudo systemctl restart postgresql

role_exists=$(sudo -u postgres psql -tAc "SELECT * FROM pg_user WHERE usename = 'treeherder';")
if [ -z "$role_exists" ]; then
  sudo -u postgres psql -c "CREATE USER treeherder WITH PASSWORD 'treeherder';"
fi

database_exists=$(sudo -u postgres psql -tAc "SELECT * FROM pg_catalog.pg_database WHERE datname = 'treeherder' ;")
if [ -z "$database_exists" ]; then
  sudo -u postgres psql -c "CREATE DATABASE treeherder WITH OWNER=treeherder
                                                            LC_COLLATE='en_US.utf8'
                                                            LC_CTYPE='en_US.utf8'
                                                            ENCODING='UTF8'
                                                            TEMPLATE=template0;"
fi

echo '-----> Running Django migrations and loading reference data'
./manage.py migrate --noinput
./manage.py load_initial_data

echo '-----> Setup complete!'
