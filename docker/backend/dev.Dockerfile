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

#### Required for running Selenium tests ####
ENV GECKODRIVER_VERSION='0.24.0'
RUN curl -sSfL --retry 5 "https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz" \
    | tar -zxC "/usr/local/bin" \
    && curl -sSfL --retry 5 'https://download.mozilla.org/?product=firefox-beta-latest&lang=en-US&os=linux64' \
    | tar -jxC "/usr/local/bin"
# Bug in Firefox which requires GTK+ and GLib in headless mode
# https://bugzilla.mozilla.org/show_bug.cgi?id=1372998
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    && rm -rf /var/lib/apt/lists/*
# Enable Firefox headless mode, avoiding the need for xvfb.
ENV MOZ_HEADLESS=1
ENV PATH="/usr/local/bin/firefox:${PATH}"

#### Required for running shellcheck tests ####
ENV SHELLCHECK_VERSION="0.4.6"
RUN curl -sSfL --retry 5 "https://storage.googleapis.com/shellcheck/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz" \
    | tar -Jx --strip-components=1 -C /usr/local/bin

# /app will be mounted via a volume defined in docker-compose
ADD . /app
WORKDIR /app

# Common and dev deps installed separately to prove that common.txt works standalone
# (given that dev.txt is not installed on Heroku)
RUN pip install --no-cache-dir --disable-pip-version-check --require-hashes -r requirements/common.txt
RUN pip install --no-cache-dir --disable-pip-version-check --require-hashes -r requirements/dev.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements/docs.txt
