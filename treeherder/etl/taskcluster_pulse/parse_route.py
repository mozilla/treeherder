# Code imported from https://github.com/taskcluster/taskcluster/blob/32629c562f8d6f5a6b608a3141a8ee2e0984619f/services/treeherder/src/util/route_parser.js


# A Taskcluster routing key will be in the form:
# treeherder.<version>.<user/project>|<project>.<revision>.<pushLogId/pullRequestId>
# [0] Routing key prefix used for listening to only treeherder relevant messages
# [1] Routing key version
# [2] In the form of user/project for github repos and just project for hg.mozilla.org
# [3] Top level revision for the push
# [4] Pull Request ID (github) or Push Log ID (hg.mozilla.org) of the push
#     Note: pushes on a branch on Github would not have a PR ID
# Function extracted from
# https://github.com/taskcluster/taskcluster/blob/32629c562f8d6f5a6b608a3141a8ee2e0984619f/services/treeherder/src/util/route_parser.js
def parseRoute(route):
    id = None
    owner = None
    parsed_project = None
    parsed_route = route.split(".")
    project = parsed_route[2]
    if len(project.split("/")) == 2:
        [owner, parsed_project] = project.split("/")
    else:
        parsed_project = project

    if len(parsed_route) == 5:
        id = parsed_route[4]

    push_info = {
        "destination": parsed_route[0],
        "id": int(id) if id else 0,
        "project": parsed_project,
        "revision": parsed_route[3],
    }

    if owner and parsed_project:
        push_info["owner"] = owner
        push_info["origin"] = "github.com"
    else:
        push_info["origin"] = "hg.mozilla.org"

    return push_info
