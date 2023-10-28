#!/usr/bin/env bash
# This file is the entrypoint for the backend container.
# It takes care of making sure to wait for the postgres and rabbitmq containers to be ready

# Make non-zero exit codes & other errors fatal.
set -euo pipefail

function check_service () {
  name=$1
  host=$2
  port=$3
  while ! nc -z "$host" "$port" &> /dev/null; do
      echo "-----> Waiting for $name server to be ready"
      sleep 1;
  done
  echo "-----> $name service is available"
}

# Keep these in sync with DATABASE_URL.
echo "Checking database status at $DATABASE_URL"
if [[ ${DATABASE_URL:0:7} == "psql://" ]]; then
  check_service "PostgreSQL" "postgres" 5432;
fi

# Keep these in sync with CELERY_BROKER_URL.
check_service "RabbitMQ" "rabbitmq" 5672

exec "$@"
