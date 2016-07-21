import logging
import re
from datetime import timedelta

from treeherder.etl.common import fetch_json
from treeherder.model.derived import JobsModel
from treeherder.perf.models import PerformanceAlertSummary
from treeherder.webapp.api.utils import UrlQueryFilter

logger = logging.getLogger(__name__)


def get_result_set(repository, result_set_id):
    filter = UrlQueryFilter({"id": result_set_id})
    full = filter.pop("full", "true").lower() == "true"
    with JobsModel(repository) as jm:
        result = jm.get_result_set_list(0, 1, full, filter.conditions)[0]
    return result


def is_merge(summary):
    """Returns a Bool of whether or not the summary given is upstream"""
    for i in range(int(summary.result_set_id), int(summary.prev_result_set_id), -1):
        try:
            result_set = get_result_set(summary.repository.name, i)
        except IndexError:
            return False

        if re.search('(merge\s)[\w]*(\sto\s)[\w]*', result_set["comments"].lower()) is not None:
            return True
        for revision in result_set["revisions"]:
            if re.search('(merge\s)[\w]*(\sto\s)[\w]*', revision["comments"].lower()) is not None:
                return True
    return False


def get_revision_from_hg(summary):
    """Get complete revision list from hg.mozilla.org associated with a push"""
    revisions = []
    for i in range(int(summary.result_set_id), int(summary.prev_result_set_id), -1):
        try:
            result_changeset = get_result_set(summary.repository.name, i)["revision"]
        except IndexError:
            continue
        r = fetch_json("https://hg.mozilla.org/integration/{}/json-pushes/".format(summary.repository.name),
                       {"full": 1,
                        "version": 2,
                        "changeset": result_changeset})
        for push in r["pushes"].keys():
            revisions.extend([changeset["node"] for changeset in r["pushes"][push]["changesets"]])
    return revisions


def classify_possible_downstream(downstream, upstream_ids):
    """From a list of possible upstreams, determine the corresponding upstream
    to each individual downstream alert

    For each of the alert in downstream, find a list of upstreams that have an
    alert with the same signature. From this list of upstream, get the complete
    revision list, and compare the list to that of the downstream.
    This should eliminate any upstream summary that have the same alert signature,
    but aren't actually upstream.
    """
    possible_upstreams = {}
    downstream_revisions = get_revision_from_hg(downstream)
    for alert in downstream.alerts.all():
        if alert.id not in possible_upstreams.keys():
            possible_upstreams[alert.id] = []
        for upstream in PerformanceAlertSummary.objects.filter(
                alerts__series_signature__signature_hash=alert.series_signature.signature_hash,
                id__in=upstream_ids,
                last_updated__gte=downstream.last_updated - timedelta(days=7)
                ):
            for i in range(int(upstream.result_set_id),
                           int(upstream.prev_result_set_id),
                           -1):
                try:
                    upstream_revisions = get_result_set(upstream.repository.name, i)
                except IndexError:
                    continue
                for revision in upstream_revisions["revisions"]:
                    if (revision["revision"] in downstream_revisions and
                        upstream.id not in possible_upstreams[alert.id]):
                        possible_upstreams[alert.id].append(upstream.id)

        if len(set(possible_upstreams[alert.id])) == 1:
            alert.status = 1
            alert.related_summary_id = possible_upstreams[alert.id][0]
            alert.save()
    return possible_upstreams


def classify(num_alerts):
    """Classify the AlertSummaries
    Args: num_alerts - The number of AlertSummaries to be classified
    """
    alertsummaries = list(PerformanceAlertSummary.objects.order_by("-last_updated").filter(status=0)[:num_alerts])

    downstreams = [summary for summary in alertsummaries if is_merge(summary)]

    upstream_ids = [summary.id for summary in alertsummaries if summary.id not in [downstream.id for downstream in downstreams]]

    mapping = {}
    for downstream in downstreams:
        mapping[downstream.id] = classify_possible_downstream(downstream, upstream_ids)
    for downstream, value in mapping.iteritems():
        logger.info("Downstream AlertSummary id: {0}, "
                    "Possible upstreams: {1}".format(
                        downstream, value
                        ))
