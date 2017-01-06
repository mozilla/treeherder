import re
from datetime import timedelta
from treeherder.etl.common import fetch_json
from treeherder.perf.models import PerformanceAlertSummary

def get_result_set_from_hg(summary):
    """
    Args:
        summary - an AlertSummary object
    Returns a result set dictionaries
    """
    # TODO
    # each repo seems to have a different url, I may have to query itno each
    # repo for the correct url
    hg_url = "{}/json-pushes".format(summary.repository.url)
    return fetch_json(hg_url, {"full": 1,
                               "version": 2,
                               "fromchange": summary.push.revision,
                               "tochange": summary.prev_push.revision})


def merge_regex(comment):
    """
    Determines whether the string given contains the word ``merge``
    Args:
        comment - A string
    Returns a Bool
    """
    if re.search('(merge\s)(.*)', comment.lower()):
        return True
    else:
        return False


def is_downstream_summary(summary):
    try:
        result_set = get_result_set_from_hg(summary)
    except IndexError:
        return False
    else:
        return any([merge_regex(changeset['desc']) for push in result_set['pushes'].values() for changeset in push['changesets']])


def find_node(hg_data, node):
    """
    Args:
        hg_data = Data from HG
        node = a String representing a commit
    returns a Bool of whether the node given exists in the hg data given
    """
    for push in hg_data['pushes'].values():
        nodes = [changeset['node'] for changeset in push['changesets']]
        if node in nodes:
            return True
    return False


def is_upstream_summary(downstream_result_set, upstream_result_set):
    """
    Args:
        downstream - A single AlertSummary
        upstream - A single AlertSummary
    Returns a bool of whether the given upstream is possible upstream to the
    downstream
    """
    for push in upstream_result_set['pushes'].values():
        nodes = [changeset['node'] for changeset in push['changesets']]
        for node in nodes:
            if find_node(downstream_result_set, node):
                return True
    return False


def get_possible_upstreams(downstream, upstreams):
    """
    Args:
        downsteam - A single AlertSummary
        upstream - A queryset of AlertSummaries that could possibly be upstream
    Returns a list of AlertSummaries that have the same performance signature
    and contains at least a revision from the downstream
    """
    signature_hashes = [alert.series_signature.signature_hash for alert in downstream.alerts.all()
                        .select_related('series_signature__signature_hash')]
    possible_upstreams = upstreams.filter(alerts__series_signature__signature_hash__in=signature_hashes,
                                          last_updated__gte=downstream.last_updated - timedelta(days=7))
    possible_upstreams = [(upstream, get_result_set_from_hg(upstream)) for upstream in possible_upstreams]
    downstream_result_set = get_result_set_from_hg(downstream)

    return [upstream for upstream , upstream_result_set in possible_upstreams
            if is_upstream_summary(downstream_result_set, upstream_result_set)]



def classify_downstream(downstream, upstreams):
    """
    Classifies a single downstream AlertSummary with the possible upstreams
    given
    Args:
        downstream - An AlertSummary
        upstreams - A AlertSummary queryset
    Returns a Bool of whether or not all of the alerts have been successfully
    classified
    """
    downstream_resultset = get_result_set_from_hg(downstream)
    upstream_resultsets = [(upstream, get_result_set_from_hg(upstream)) for upstream in upstreams]
    # for each of the alert in the downstream summary
    for alert in downstream.alerts.all():
        possible_upstreams = []
        for upstream, upstream_resultset in upstream_resultsets:
            if (is_upstream_summary(downstream_resultset, upstream_resultset) and
                alert.series_signature.signature_hash in [upstream_alert.series_signature.signature_hash for upstream_alert in upstream.alerts.all()]):
                possible_upstreams.append(upstream)
        if len(set([possible_upstream.id for possible_upstream in possible_upstreams])) == 1: 
            alert.status = 1
            alert.related_summary = possible_upstreams[0]
            alert.save()
    return True


def classify(num_alerts=100):
    """
    Classify AlertSumamries
    Args:
        num_alerts - Number of AlertSummaries to classify
    """
    alertsummaries = (PerformanceAlertSummary.objects
                                             .order_by("-last_updated")
                                             .filter(status=0)[:num_alerts])

    downstreams = filter(is_downstream_summary, alertsummaries)
    upstream_ids = [summary.id for summary in summaries if summary not in downstreams]
    upstreams = PerformanceAlertSummary.objects.filter(id__in=upstream_ids)

    for downstream in downstreams:
        classify_downstream(downstream, get_possible_upstreams(upstreams))

    return alertsummaries
