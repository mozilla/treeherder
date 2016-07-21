import datetime
import httplib
import json

from treeherder.model.derived import JobsModel
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary)
from treeherder.webapp.api.utils import UrlQueryFilter

treeherder_url = "treeherder.mozilla.org"
hg_url = "hg.mozilla.org"
request_count = 0


def transform_alert(alert):
    """
    Transform the given Alert to the fromat required
    """
    return {"id": int(alert.id),
            "signature": alert.series_signature.signature_hash}


def transform_alertsummary(alertsummary):
    """ Transform the given AlertSummary to the format required """
    return {"id": int(alertsummary.id),
            "result_set_id": int(alertsummary.result_set_id),
            "prev_result_set_id": int(alertsummary.prev_result_set_id),
            "last_updated": alertsummary.last_updated,
            "repository": alertsummary.repository.name,
            "alerts": [transform_alert(alert) for alert in alertsummary.alerts.all()],
            "related_alerts": [transform_alert(alert) for alert in alertsummary.related_alerts.all()],
            "status": int(alertsummary.status)}


def transform_revision(revision):
    """ Transform the given Revision to the format required """
    return {"comments": revision["comments"],
            "revision": revision["revision"]}


def transform_resultset(resultset):
    """ Transform the given Resultset to the format required """
    return {"id": resultset["id"],
            "comments": resultset["comments"],
            "revision": resultset["revision"],
            "revisions": [transform_revision(revision) for revision in resultset["revisions"]]}


def treeherder_request(endpoint):
    """Return a dictioanry of the JSON returned from an endpoint"""
    conn = httplib.HTTPSConnection(treeherder_url)
    headers = {"User-Agent": "Automatic downstream classification script"}
    conn.request("GET", endpoint, {}, headers)

    global request_count
    request_count += 1
    print "{}. {}".format(request_count, endpoint)

    return json.loads(conn.getresponse().read())


def hg_request(endpoint):
    """Return a dictionary of the JSON returned from an endpoint"""
    conn = httplib.HTTPSConnection(hg_url)
    headers = {"User-Agent": "Automatic downstream classification script. If I'm overloading the server, please find royc on #treeherder"}
    conn.request("GET", endpoint, {}, headers)

    global request_count
    request_count += 1
    print "{}. {}".format(request_count, endpoint)

    return json.loads(conn.getresponse().read())


def get_all_alertsummaries(url="/api/performance/alertsummary/", pages=10):
    """Returns a list of AlertSummary """
    return [transform_alertsummary(summary) for summary in PerformanceAlertSummary.objects.order_by("-last_updated")[:100]]


def parse_time(time):
    """Returns a datetime object of the time given in the format
    "%Y-%m-%dT%H:%M:%S" """
    return datetime.datetime.strptime(time, "%Y-%m-%dT%H:%M:%S")


def get_extra_alertsummaries(end, url="/api/performance/alertsummary/?page=11"):
    """Returns a list of AlertSummary to act as reference
    """
    return [transform_alertsummary(summary) for summary in PerformanceAlertSummary.objects.order_by("-last_updated").filter(last_updated__gte=end)[100:]]


def get_alertsummary_resultset_list(alertsummary):
    """Returns a list of tuples ("repo", "result_set_id")
    """
    return [(alertsummary["repository"], i) for i in range(alertsummary["result_set_id"], alertsummary["prev_result_set_id"], -1)]


def get_resultset_map(repository, resultset_id):
    """Returns a dictioanry mapping the resultset
    Args:
        repository: the repository in question
        resultset: the resultset in question
    """
    filter = UrlQueryFilter({"id": resultset_id})
    full = filter.pop('full', 'true').lower() == 'true'
    with JobsModel(repository) as jm:
        result = jm.get_result_set_list(0, 1, full, filter.conditions)[0]
    result = transform_resultset(result)

    is_merge = False
    if "merge" in result["comments"].lower():
        is_merge = True

    i = 0
    while(is_merge is not False and i < len(result["revisions"])):
        if "merge" in result["revisions"][i]["comments"].lower():
            is_merge = True
        i += 1
    return {"revisions": result["revisions"], "is_merge": is_merge, "changeset": result["revision"]}


def get_all_revision_map(alertsummaries):
    """Returns a dictionary mapping repository to resultset to revisions
    Args:
        alertsummaries: a list of AlertSummaries
    """
    empty_set = {"is_merge": False, "revisions": []}
    repo_mapping = {}
    for alertsummary in alertsummaries:
        repo = alertsummary["repository"]
        if repo not in repo_mapping:
            repo_mapping[repo] = {}
        for repo, result_set_id in get_alertsummary_resultset_list(alertsummary):
            if result_set_id not in repo_mapping[repo]:
                try:
                    repo_mapping[repo][result_set_id] = get_resultset_map(repo, result_set_id)
                except ValueError:
                    repo_mapping[repo][result_set_id] = empty_set
                except IndexError:
                    repo_mapping[repo][result_set_id] = empty_set
    return repo_mapping


def add_related_alerts(alertsummary):
    """Add related alerts to list of alerts"""
    alertsummary["alerts"].extend(alertsummary["related_alerts"])
    return alertsummary


def is_downstream_alertsummary(alertsummary, revision_map):
    """Returns a Boolean of whether the alertsummary is upstream"""
    for repo, resultset_id in get_alertsummary_resultset_list(alertsummary):
        if revision_map[repo][resultset_id]["is_merge"]:
            return True
    return False


def get_downstream_alertsummaries(alertsummaries, revision_map):
    """Return a list of AlertSummaries that have been identified as downstream"""
    return filter(lambda summary: is_downstream_alertsummary(summary, revision_map), alertsummaries)


def get_upstream_alertsummaries(alertsummaries, downstreams):
    """Return a list of AlertSummaries that have been identified as upstream"""
    downstream_ids = [alert['id'] for alert in downstreams]
    return [add_related_alerts(summary) for summary in alertsummaries if (summary['id'] not in downstream_ids and summary["status"] != 2)]


def get_single_upstream_revisions(repo, resultset_id, revision_map):
    """Return a list of revision ids of a single upstream
    """
    changeset = revision_map[repo][resultset_id]["changeset"]
    result = hg_request("/integration/{}/json-pushes/?full=1&version=2&changeset={}".format(repo, changeset))
    revisions = []
    for push in result["pushes"].keys():
        for changeset in result["pushes"][push]["changesets"]:
            revisions.append(changeset["node"])
    return revisions


def get_downstream_revisions(alertsummaries, revision_map):
    revisions = {}
    for alertsummary in alertsummaries:
        if alertsummary["id"] not in revisions.keys():
            revisions[alertsummary["id"]] = []
        for repo, resultset_id in get_alertsummary_resultset_list(alertsummary):
            revisions[alertsummary["id"]].extend(get_single_upstream_revisions(repo, resultset_id, revision_map))
    return revisions


def get_upstream_revisions(alertsummaries, revision_map):
    revisions = {}
    for alertsummary in alertsummaries:
        for repo, resultset_id in get_alertsummary_resultset_list(alertsummary):
            for revision in revision_map[repo][resultset_id]["revisions"]:
                if revision["revision"] not in revisions.keys():
                    revisions[revision["revision"]] = []
                revisions[revision["revision"]].append(alertsummary["id"])
    return revisions


def is_possible_upstream(downstream, upstream):
    """Return a bool of whether the summary given could be upstream of the
    given downstream
    Args:
        downstream - A downstream AlertSummary
        upstream - A possible upstream AlertSummary
    """
    downstream_signatures = [alert["signature"] for alert in downstream['alerts']]
    upstream_signatures = [alert["signature"] for alert in upstream["alerts"]]

    return len(set(downstream_signatures).intersection(upstream_signatures)) > 0


def identify_possible_upstreams(downstream, summaries):
    """Return a list of AlertSummary that could be upstream
    Args:
        downstream - an AlertSummary that has been identified as downstream
        summaries - a list of AlertSummary to filter from
    """
    return filter(lambda summary: is_possible_upstream(downstream, summary), summaries)


def identify_true_upstream(downstream, upstreams, downstream_revisions, upstream_revision_map):
    upstream_list = []
    for revision in downstream_revisions[downstream["id"]]:
        if revision not in upstream_revision_map.keys():
            continue
        for upstream in upstream_revision_map[revision]:
            if upstream not in upstream_list:
                upstream_list.append(upstream)
    alerts = {}
    for alert in downstream["alerts"]:
        alerts[alert["id"]] = []
        for upstream in upstreams:
            if (alert["id"] in [upstream_alert["id"] for upstream_alert in upstream["alerts"]] and
                upstream["id"] in upstream_list and
                upstream["id"] not in alerts[alert["id"]]):
                alerts[alert["id"]].append(upstream["id"])
    return alerts


def combine_upstreams(original, extra):
    return original + extra


def combine_upstream_revisions(original, extra):
    revisions = {}
    for key, value in original.iteritems():
        revisions[key] = value

    for key, value in extra.iteritems():
        if key in revisions.keys():
            revisions[key].extend(value)
        else:
            revisions[key] = value
    return revisions


def update_alert(alert_id, upstream_ids):
    if len(upstream_ids) == 1:
        alert = PerformanceAlert.objects.get(pk=alert_id)
        alert.related_summary_id = [upstream_ids][0]
        alert.save()


def classify():
    alertsummaries = get_all_alertsummaries()
    revision_map = get_all_revision_map(alertsummaries)
    downstreams = get_downstream_alertsummaries(alertsummaries, revision_map)
    upstreams = get_upstream_alertsummaries(alertsummaries, downstreams)
    upstream_revisions = get_upstream_revisions(upstreams, revision_map)
    downstream_revisions = get_downstream_revisions(downstreams, revision_map)

    end_date_of_reference = alertsummaries[-1]["last_updated"] - datetime.timedelta(days=7)
    extra_alertsummaries = get_extra_alertsummaries(end_date_of_reference)
    extra_revision_map = get_all_revision_map(extra_alertsummaries)
    extra_downstreams = get_downstream_alertsummaries(extra_alertsummaries, extra_revision_map)
    extra_upstreams = get_upstream_alertsummaries(extra_alertsummaries, extra_downstreams)
    extra_upstream_revisions = get_upstream_revisions(extra_upstreams, extra_revision_map)

    reference_upstreams = combine_upstreams(upstreams, extra_upstreams)
    reference_upstream_revisions = combine_upstream_revisions(upstream_revisions, extra_upstream_revisions)

    for downstream in downstreams:
        possible_upstream = identify_possible_upstreams(downstream, reference_upstreams)
        alert_map = identify_true_upstream(downstream,
                                           possible_upstream,
                                           downstream_revisions,
                                           reference_upstream_revisions)
        # for downstream_alert, related_upstreams in alert_map.iteritems():
        #     update_alert(downstream_alert, related_upstreams)

        print "Downstream: {}".format(downstream["id"])
        print "Narrowed upstreams: {}".format(alert_map)
        print "\n"
