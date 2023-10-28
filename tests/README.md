# Backend development

The backend test suite can be run outside the Docker container.

## Start the services

We need all but the main `backend` service running.  Since multiple `backend` instances are allowed, we will simply start everything up

    # ENSURE THE IMAGES ARE CLEAN
    docker rm "/postgres"
    docker rm "/frontend"
    docker rm "/rabbitmq" 
    docker rm "/redis"
    docker rm "/backend"
    docker-compose down
    docker volume rm treeherder_postgres_data 
    
    # SETUP ALL IMAGES
    docker-compose up --build

## Install into virtual environment

Treeherder requires specific library versions that will likely interfere with what you have installed. It is best to setup a virtual environment to contain the quirks it introduces.

Be sure you are in the `treeherder` main directory

    python -m venv .venv             # IMPORTANT: Notice the dot in the name
    source .venv/bin/activate
    pip install --no-deps -r requirements/dev.txt
    pip install --no-deps -r requirements/common.txt

...or Windows...

    python -m pip install virtualenv  # venv is buggy on Windows
    REM IMPORTANT: Notice the dot in `.venv`
    python -m virtualenv .venv             
    .venv\Scripts\activate
    pip install --no-deps -r requirements\dev.txt
    pip install --no-deps -r requirements\common.txt

... or MacOS

    python -m venv .venv             # IMPORTANT: Notice the dot in the name
    source .venv/bin/activate
    pip install --no-deps -r requirements/dev.txt
    pip install --no-deps -r requirements/common.txt

> The pip install order is important:  We want the `common` requirements to overwrite the `dev` requirements (in the event there are conflicts)

## Set environment variables

For Windows, Treeherder requires a number of environment variables that point to the services.  In our case, those services are in local docker containers.

    .\tests\env.bat

If you plan to use an IDE, here is the same, as a very long line

    BROKER_URL=localhost//guest:guest@rabbitmq//;DATABASE_URL=psql://postgres:mozilla1234@postgres:5432/treeherder;REDIS_URL=redis://localhost:6379;SITE_URL=http://backend:8000/;TREEHERDER_DEBUG=True;TREEHERDER_DJANGO_SECRET_KEY=secret-key-of-at-least-50-characters-to-pass-check-deploy;NEW_RELIC_DEVELOPER_MODE=True

## Ensure everything is working

Django can perform a number of checks to ensure you are configured correctly

    ./manage.py check

## Running tests

Be sure docker-compose is up, you are in the `treeherder` main directory, your virtual environment is activated, and your environment variables are set:

Linux/MacOS

    source .venv/bin/activate

Windows

    .venv\Script\activate

Followed by either one of the two commands below.

### All tests

    pytest tests

### Start TDD-enhanced test runner in the background

Whenever code changes are detected within the project, command below will run only the associated tests.
Test runs will be triggered for either application or tests code changes.

This workflow ensures a considerably faster feedback loop for those wanting to do test driven development.

    ptw --runner "pytest --testmon" --clear

## Pre commit checks

If you made some changes, and want to submit a pull request; run the `./runtests.sh` script (found in the main directory).  It will run some linters to check your submission.

> For Windows, you can run the checks in a container (see below)

## Run tests in container

After `docker-compose up`, you may spin up any number of `backend` containers. You may want to run ingestion tasks, go exploring, or run the tests.

    docker-compose exec backend bash

docker-compose has three execution modes

* `exec` - run just the service, and assume the others are running
* `run` - run all the services, but do not open their ports
* `up` - run all the services with ports open

More can be read here: [docker-composes up vs run vs exec](https://medium.com/@zhao.li/how-to-understand-the-difference-between-docker-composes-up-vs-run-vs-exec-commands-a506151967df)

Inside this container

    pytest tests

## Setup git pre-commit hook

Running checks locally will allow you to catch linting errors faster. We put the git pre-commit hook into the virtual environment to avoid polluting your dev machine

    .venv\Scripts\activate
    pip install pre-commit
    pre-commit install
