#!/usr/bin/env python
""" Script to compare pushes from a Treeherder instance against production.

This is useful to compare if pushes between two different instances have been
ingested differently.
"""
import argparse
import logging

from deepdiff import DeepDiff
from thclient import TreeherderClient

logging.basicConfig()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
HOSTS = {
    "localhost": "http://localhost:8000",
    "stage": "https://treeherder.allizom.org",
    "production": "https://treeherder.mozilla.org",
}


def main(args):
    compare_to_client = TreeherderClient(server_url=HOSTS[args.host])
    production_client = TreeherderClient(server_url=HOSTS["production"])

    # Support comma separated projects
    projects = args.projects.split(',')
    for _project in projects:
        logger.info("Comparing {} against production.".format(_project))
        # Remove properties that are irrelevant for the comparison
        pushes = compare_to_client.get_pushes(_project, count=50)
        for _push in sorted(pushes, key=lambda push: push["revision"]):
            del _push["id"]
            for _rev in _push["revisions"]:
                del _rev["result_set_id"]

        production_pushes = production_client.get_pushes(_project, count=50)
        for _push in sorted(production_pushes, key=lambda push: push["revision"]):
            del _push["id"]
            for _rev in _push["revisions"]:
                del _rev["result_set_id"]

        for index in range(0, len(pushes)):
            assert pushes[index]["revision"] == production_pushes[index]["revision"]
            difference = DeepDiff(pushes[index], production_pushes[index])
            if difference:
                logger.info(difference.to_json())
                logger.info(
                    "{}/#/jobs?repo={}&revision={}".format(
                        compare_to_client.server_url, _project, pushes[index]["revision"]
                    )
                )
                logger.info(
                    "{}/#/jobs?repo={}&revision={}".format(
                        production_client.server_url, _project, production_pushes[index]["revision"]
                    )
                )


def get_args():
    parser = argparse.ArgumentParser(
        "Compare a push from a Treeherder instance to the production instance."
    )
    parser.add_argument("--host", default="stage", help="Host to compare. It defaults to stage")
    parser.add_argument(
        "--projects",
        default="android-components,fenix",
        help="Projects (comma separated) to compare. It defaults to android-components & fenix",
    )

    args = parser.parse_args()
    return args


if __name__ == "__main__":
    main(get_args())
