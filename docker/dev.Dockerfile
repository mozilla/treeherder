# Use the same Python version as in Heroku (see runtime.txt)
FROM python:3.7.2

# Variables that are not specific to a particular environment.
ENV NEW_RELIC_CONFIG_FILE newrelic.ini

# libmysqlclient-dev and gcc are required for the mysqlclient Python package.
# netcat is used for the MySQL readiness check in entrypoint.sh.
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev \
    gcc \
    netcat \
    && rm -rf /var/lib/apt/lists/*

# /app will be mounted via a volume defined in docker-compose
ADD . /app
WORKDIR /app

# Common and dev deps installed separately to:
# (a) prove that common.txt works standalone (given dev.txt not installed on Heroku)
# (b) to reduce amount of cache invalidation when only dev.txt updated
RUN pip install --no-cache-dir --disable-pip-version-check --require-hashes -r requirements/common.txt
RUN pip install --no-cache-dir --disable-pip-version-check --require-hashes -r requirements/dev.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements/docs.txt
