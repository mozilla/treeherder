# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

# Mapping is taken from docker link assumptions
export TREEHERDER_DEBUG='1'
export TREEHERDER_DJANGO_SECRET_KEY='5up3r53cr3t'
# Allow any host to be hit when running in development mode
export TREEHERDER_ALLOWED_HOSTS='*'

# link : mysql
export DATABASE_URL="mysql://root:${MYSQL_ENV_MYSQL_ROOT_PASSWORD}@mysql/${MYSQL_ENV_MYSQL_DATABASE}"
export DATABASE_URL_RO=$DATABASE_URL

# link: memcached
export TREEHERDER_MEMCACHED='memcached:11211'

# link rabbitmq
export TREEHERDER_RABBITMQ_HOST='rabbitmq'
