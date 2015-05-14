# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

FROM python:2.7
MAINTAINER Mozilla
RUN virtualenv /venv
ENV PATH /venv/bin:$PATH
WORKDIR /app
RUN apt-get update && apt-get install -yq --force-yes mysql-client
COPY ./requirements/common.txt /app/requirements.txt
COPY ./docker/etc/profile.d/treeherder.sh /etc/profile.d/treeherder.sh
COPY . /app
RUN ./bin/peep.py install -r requirements.txt
RUN ./setup.py build_ext --inplace
RUN mkdir -p /var/log/gunicorn && mkdir -p /var/log/treeherder/
