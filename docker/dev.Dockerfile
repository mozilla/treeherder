FROM python:3.10.17-bullseye

# Variables that are not specific to a particular environment.
ENV NEW_RELIC_CONFIG_FILE newrelic.ini

# netcat is used for the Postgres readiness check in entrypoint.sh.
RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat \
    && rm -rf /var/lib/apt/lists/*

# Bug in Firefox which requires GTK+ and GLib in headless mode
# https://bugzilla.mozilla.org/show_bug.cgi?id=1372998
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    && rm -rf /var/lib/apt/lists/*
# Enable Firefox headless mode, avoiding the need for xvfb.
ENV MOZ_HEADLESS=1
ENV PATH="/usr/local/bin/firefox:${PATH}"

# /app will be mounted via a volume defined in docker-compose
ADD . /app
WORKDIR /app

# Common and dev deps installed separately to prove that common.txt works standalone
RUN pip install --no-deps --no-cache-dir --disable-pip-version-check --require-hashes -r requirements/dev.txt
RUN pip install --no-deps --no-cache-dir --disable-pip-version-check --require-hashes -r requirements/common.txt

# Setup home so it's readable by nobody
# mozci will try to read a configuration file there
ENV HOME=/home
RUN mkdir -p $HOME && chown nobody:nogroup $HOME
