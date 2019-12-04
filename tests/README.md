## Backend development

The backend test suite can be run locally. 

### Start the services

We need all but the main `backend` service running.  Since multiple `backend` instances are allowed, we will simply start everything up

    # ENSURE THE IMAGES ARE CLEAN
    docker-compose down
    # SETUP ALL IMAGES
    docker-compose up --build

### Install into virtual environment

Treeherder, Django, and the required libraries will ruin you local Python install. It is best to setup a virtual environment to contain the quirks it introduces.

Be sure you are in the `treeherder` main directory

    pip install virtualenv
    virtualenv venv
    source venv/bin/activate
    venv/bin/pip install -r tests/requirements.txt

...or Windows...

    pip install virtualenv
    virtualenv venv
    venv\Scripts\activate
    pip install -r tests/requirements.txt

Please notice the special `requirements.txt` file

### Set environment variables

Treeherder requires a number of environment variables that point to the services.  In our case, those services are in local docker containers.

    ./tests/env.sh     # env.bat for Windows

If you plan to use an IDE, here is the same, as a very long line

```
BROKER_URL=localhost//guest:guest@rabbitmq//;DATABASE_URL=mysql://root@localhost:3306/treeherder;REDIS_URL=redis://localhost:6379;SITE_URL=http://backend:8000/;TREEHERDER_DEBUG=True;TREEHERDER_DJANGO_SECRET_KEY=secret-key-of-at-least-50-characters-to-pass-check-deploy;NEW_RELIC_DEVELOPER_MODE=True
```

### Ensure everything is working

Django can perform a number of checks to ensure you are configured correctly

    python manage.py check

### Run the tests

Be sure you are in the `treeherder` main directory, with your virtual environment activated, and your environment variables set:

    source venv/bin/activate
    ./tests/env.sh
    pytest tests

### Using containers

After `docker-compose up`, you may spin up any number of `backend` containers. You may want to run ingestion tasks, or go exploring. 

    docker-compose exec backend bash

docker-compose has three execution modes

* `exec` - run just the service, and assume the others are running
* `run` - run all the services, but do not open their ports
* `up` - run all the services with ports open

More can be read here: [docker-composes up vs run vs exec](https://medium.com/@zhao.li/how-to-understand-the-difference-between-docker-composes-up-vs-run-vs-exec-commands-a506151967df)
