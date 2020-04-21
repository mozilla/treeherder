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
    parsedProject = None
    parsedRoute = route.split('.')
    project = parsedRoute[2]
    if len(project.split('/')) == 2:
        [owner, parsedProject] = project.split('/')
    else:
        parsedProject = project

    if len(parsedRoute) == 5:
        id = parsedRoute[4]

    pushInfo = {
        "destination": parsedRoute[0],
        "id": int(id) if id else 0,
        "project": parsedProject,
        "revision": parsedRoute[3],
    }

    if owner and parsedProject:
        pushInfo["owner"] = owner
        pushInfo["origin"] = 'github.com'
    else:
        pushInfo["origin"] = 'hg.mozilla.org'

    return pushInfo
