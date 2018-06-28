#!/usr/bin/env bash

export PATH="${HOME}/firefox:${HOME}/python/bin:${PATH}"

export BROKER_URL='amqp://guest:guest@localhost//'
export DATABASE_URL='mysql://root@localhost/treeherder'
export ELASTICSEARCH_URL='http://localhost:9200'
export REDIS_URL='redis://localhost:6379'

export TREEHERDER_DEBUG='True'
export TREEHERDER_DJANGO_SECRET_KEY='secret-key-of-at-least-50-characters-to-pass-check-deploy'
export NEW_RELIC_CONFIG_FILE='newrelic.ini'
export NEW_RELIC_DEVELOPER_MODE='True'

# Enable Firefox headless mode, avoiding the need for xvfb.
export MOZ_HEADLESS=1

# Allow dev-servers to know they should enable polling mode for filesystem watching,
# since inotify is not supported by Virtualbox shared folders.
export USE_WATCH_POLLING=1
