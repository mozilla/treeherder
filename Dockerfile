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
RUN mkdir -p /var/log/gunicorn && mkdir -p /var/log/treeherder/
