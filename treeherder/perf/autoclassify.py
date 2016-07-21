import json
from datetime import timedelta

from treeherder.etl.common import make_request
from treeherder.model.derived import JobsModel
from treeherder.perf.models import PerformanceAlertSummary
from treeherder.webapp.api.utils import UrlQueryFilter


def get_result_set(repository, result_set_id):
    filter = UrlQueryFilter({"id": result_set_id})
    full = filter.pop("full", "true").lower() == "true"
    with JobsModel(repository) as jm:
        result = jm.get_result_set_list(0, 1, full, filter.conditions)[0]
    return result


def is_downstream(summary):
    """Returns a Bool of whether or not the summary given is upstream"""
    for i in range(int(summary.result_set_id), int(summary.prev_result_set_id), -1):
        try:
            result_set = get_result_set(summary.repository.name, i)
        except IndexError:
            return False
        if "merge" in result_set["comments"].lower():
            return True
        for revision in result_set["revisions"]:
            if "merge" in revision["comments"].lower():
                return True
    return False


def get_revision_from_hg(summary):
    """Get complete revision list from hg.mozilla.org"""
    revisions = []
    for i in range(int(summary.result_set_id), int(summary.prev_result_set_id), -1):
        result_changeset = get_result_set(summary.repository.name, i)["revision"]
        r = json.loads(make_request("https://hg.mozilla.org/integration/{}/json-pushes/?full=1&version=2&changeset={}".format(summary.repository.name,
                                         result_changeset)).text)
        for push in r["pushes"].keys():
            revisions.extend([changeset["node"] for changeset in r["pushes"][push]["changesets"]])
    return revisions


def classify_downstream(downstream, upstream_ids):
    possible_upstreams = {}
    revisions = get_revision_from_hg(downstream)
    for alert in downstream.alerts.all():
        if alert.id not in possible_upstreams.keys():
            possible_upstreams[alert.id] = []
        for upstream in PerformanceAlertSummary.objects.filter(
                alerts__series_signature__signature_hash=alert.series_signature.signature_hash,
                id__in=upstream_ids
                ):
            for i in range(int(upstream.result_set_id),
                           int(upstream.prev_result_set_id),
                           -1):
                try:
                    upstream_revisions = get_result_set(upstream.repository.name, i)
                except IndexError:
                    continue
                for revision in upstream_revisions["revisions"]:
                    if revision["revision"] in revisions:
                        possible_upstreams[alert.id].append(upstream.id)
        if len(set(possible_upstreams[alert.id])) == 1:
            alert.status = 1
            alert.related_summary_id = possible_upstreams[alert.id][0]
            alert.save()
    return possible_upstreams


def classify():
    alertsummaries = list(PerformanceAlertSummary.objects.order_by("-last_updated")[:100])
    reference = list(PerformanceAlertSummary.objects.filter(last_updated__gte=alertsummaries[-1].last_updated - timedelta(days=7)))

    downstreams = [summary for summary in alertsummaries if is_downstream(summary)]

    upstream_ids = [summary.id for summary in alertsummaries if summary.id not in [downstream.id for downstream in downstreams]]

    mapping = {}
    for downstream in downstreams:
        mapping[downstream.id] = classify_downstream(downstream, upstream_ids)
    for downstream, value in mapping.iteritems():
        print "Downstream: {}".format(downstream)
        print "Possibles: {}".format(value)
