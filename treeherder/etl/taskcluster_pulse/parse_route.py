# Code imported from https://github.com/taskcluster/taskcluster/blob/32629c562f8d6f5a6b608a3141a8ee2e0984619f/services/treeherder/src/util/route_parser.js


# A Taskcluster routing key can be in two formats:
#
# v1: tc-treeherder.v1.<project>.<revision>.<pushLogId/pullRequestId>
# v2: tc-treeherder.v2.<trust_domain>.<project>.<branch>.<revision>.<pushLogId/pullRequestId>
#
# Function extracted from
# https://github.com/taskcluster/taskcluster/blob/32629c562f8d6f5a6b608a3141a8ee2e0984619f/services/treeherder/src/util/route_parser.js
def parse_route(route):
    parsed_route = route.split(".")

    if len(parsed_route) < 4:
        raise ValueError(f"Route has too few segments: {route}")

    version = parsed_route[1]

    if version == "v1":
        return parse_route_v1(parsed_route)
    elif version == "v2":
        return parse_route_v2(parsed_route)
    else:
        raise ValueError(f"Unrecognized route version '{version}': {route}")


def parse_route_v1(parsed_route):
    """
    Parse v1 format: tc-treeherder.v1.<project>.<revision>.<id>
    """
    id = None
    parsed_project = None
    project = parsed_route[2]

    if len(project.split("/")) == 2:
        _, parsed_project = project.split("/")
    else:
        parsed_project = project

    if len(parsed_route) == 5:
        id = parsed_route[4]

    push_info = {
        "destination": parsed_route[0],
        "version": "v1",
        "id": int(id) if id else 0,
        "project": parsed_project,
        "revision": parsed_route[3],
    }

    return push_info


def parse_route_v2(parsed_route):
    """
    Parse v2 format: tc-treeherder.v2.<trust_domain>.<project>.<branch>.<revision>.<id>
    """
    if len(parsed_route) < 6:
        raise ValueError(f"v2 route has too few segments: {'.'.join(parsed_route)}")

    push_info = {
        "destination": parsed_route[0],
        "version": "v2",
        "trust_domain": parsed_route[2],
        "project": parsed_route[3],
        "branch": parsed_route[4],
        "revision": parsed_route[5],
        "id": int(parsed_route[6]) if len(parsed_route) > 6 else 0,
    }

    return push_info
