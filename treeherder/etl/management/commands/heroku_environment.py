#!/usr/bin/env python
""" Script to validate each Heroku app as part of the release step or from local environment

Locally an engineer with access to Heroku can use this script because we can authenticate
with the Heroku CLI and fetch the env variables. For now you will need to install the Heroku CLI
(https://devcenter.heroku.com/articles/heroku-cli) rather than figurying out how to authenticate
using the APIs (https://devcenter.heroku.com/articles/platform-api-quickstart).

In order to authenticate your machine first call `heroku auth:login` from the command.

Plan:

* Add more values to MUST_BE_SET and MUST_BE_SET_TO
* Providing no --app-name validates all 5 Heroku apps
* Count that the number of environment variables is not larger than what expected
* See if we can define MUST_BE_SET variables in treeherder/config/settings.py and import it here
* Document usage
* Add support for validation in the context of bin/pre_deploy
  * Do not fetch config vars but check environment directly
* This code could be moved into a Pypi package and permit other companies to use it

Once this script is further along we can call it from ./bin/pre_deploy which is part of the
release step for Heroku apps. Failing to pass the script would prevent an app to be deployed
if it has missing or incorrect values. The user will then have to add the environment variable
to the failing Heroku app and retry the release step.

Ideally we would catch Heroku app misconfigurations in Travis, however, that would require
fetching env variables from Travis and risk leakage. If we wanted to we could use Taskcluster
to run a task for us on every commit when treeherder/config/settings.py is touched. We should
make sure that logs from the task are only viewable by certain members with scopes. Without this
restriction the idea is a no-go since we could inadvertadely leak secrets.
"""
import logging
import sys

import requests
from django.core.management.base import BaseCommand

from treeherder.utils.http import make_request

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# These are environment variables that need to be set
MUST_BE_SET = {
    "treeherder-stage": [
        "NEW_RELIC_INSIGHTS_API_KEY",
        "THIS_ONE_WILL_FAIL"
    ]
}

# These are environment variables that need to be set to a specific value
MUST_BE_SET_TO = {
    "treeherder-stage": {
        "BUGZILLA_API_URL": "https://bugzilla.mozilla.org",
        "THIS_ONE_WILL_FAIL": "foo"
    }
}


def request(path="", method="GET"):
    return make_request("https://api.heroku.com/apps/{}".format(path), method=method, headers={
        'Accept': 'application/vnd.heroku+json; version=3'
    })


def authenticate():
    try:
        request(method="POST")
    except requests.exceptions.HTTPError as error:
        if error.response.status_code == 401:
            logger.critical("Run heroku auth:login to authenticate the terminal before calling this script.")
            sys.exit(-1)


def get_config_vars(app_name):
    response = request("{}/config-vars".format(app_name))
    return response.json()


class Command(BaseCommand):
    """Management command to validate Heroku environment variables."""
    def add_arguments(self, parser):
        parser.add_argument(
            "--app",
            help="Heroku app name"
        )

    def handle(self, *args, **options):
        app_name = options["app"]
        assert app_name in ["treeherder-stage"], "Choose a valid Heroku app name with --app"
        authenticate()
        # NOTE: Be councious that the secrets contained in here are only accessible
        # if you have Heroku access to the apps OR that executing inside bin/pre_deploy
        # also requires Heroku access to view
        config_vars = get_config_vars(app_name)

        errors = False

        # Validate that these are set
        for key in MUST_BE_SET[app_name]:
            try:
                config_vars[key]
            except KeyError:
                logger.error("{} must be set.".format(key))
                errors = True

        # Validate that it is set to a specific value
        for key, value in MUST_BE_SET_TO[app_name].items():
            try:
                if config_vars[key] != value:
                    errors = True

            except KeyError:
                logger.error("{} must be set to this value: {}.".format(key, value))
                errors = True

        if errors:
            sys.exit(-1)
