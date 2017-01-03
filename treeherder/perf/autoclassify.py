<<<<<<< Updated upstream
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
    """
    Get a list of revisions of the Downstream commit from hg

    create a dictionary with all the AlertSumarmy.alert.ids as keys

    from a list of PerformanceAlertSummary, filtered by signature_hash, upstream id,  and
    last_updated, this should include all of the PerformanceAlertSummary that
    have the same performance alerts, and have included possible upstream
    AlertSummaries

    from this list, get a range of result_set ids, and retrieve all the commit
    revisions corresponding to this performance alert summary

    if the revisions returned from the upstream result sets is one of the
    revisions in the downstream alert summary, call it done
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


def contains_word_merge(text):
    """Return a Boolean of whether or not the text given contains the word
    ``merge``
    """
    if not re.search('(merge)[\s\S]*(to)[\s\S]*', text.lower()):
        return False
    else:
        return True

def resultset_is_merge(repository, resultset_id):
    """Return a Boolean of whether or not the resultset given contains the word
    ``merge``
    Args:
        repository - A String of the repository name
        resultset_id - Int of resultset ID
    """
    try:
        result_set = get_result_set(repository, resultset_id)
        if contains_word_merge(result_set["comments"].lower()):
            return True
        else:
            return any([contains_word_merge(revision["comments"].lower()) for revision in
            result_set["revisions"]])
    except IndexError:
        return False

def summary_is_merge(alertsummary):
    """Return a Boolean of whether or not the summary given has resultset that
    is merged
    Args:
        alertsummary - A PerformanceAlertSummary object
    """
    return any([resultset_is_merge(alertsummary.repository.name, resultset) for resultset in range(alertsummary.result_set_id, alertsummary.prev_result_set_id, -1)])



def upstream_contains_revision(upstream, revisions):
    """Returns a boolean of whether the upstream given contains one of the
    revisions given

    Args:
        upstream: A PerformanceAlertSummary object,
        revisions: A list of revisions
    """
    upstream_revisions = [get_result_set(upstream.repository.name, i) for i in range(upstream.result_set_id, upstream.prev_result_set_id, -1)]
    return any(upstream_revision in revisions for upstream_revision in upstream_revisions)

def classify_alert_to_upstream(alert, revisions, possible_upstreams, last_updated):
    """Return a list of PerformanceAlertSummaries that have the possiblity of
    being upstream to the alert
    Args:
        alert - An Alert object,
        revisions - A list of Revision ids
        possible_upstreams - A list of PerformanceAlertSummaries
        last_updated - Datetime
    """
    upstreams = PerformanceAlertSummary.objects.filter(
        alerts__series_signature__signature_hash__in = alert.series_signature.signature_hash,
        id__in = [upstream.id for upstream in possible_upstreams],
        last_updated__gte = last_updated - timedelta(days=7)
    )
    return [upstream for upstream in upstreams if upstream_contains_revisions(upstream, revisions)]

def classify_possible_downstream2(downstream, upstreams):
    """
    Returns a dictionary in the following format
    {
        alert_id: [upstream_id1, upstream_id2, ..],
        alert_id: [..]
    } 
    """
    # from a list of alert_signatures, filter a list of PerformanceAlertSummary
    # that contains one of the signatures. Iterate through the list, and return
    # id of the PerformanceAlertSummary that contains the same revisions as the
    # downstream PerformanceAlertSummary
    downstream_revisions = get_revision_from_hg(downstream)
    return dict((alert, classify_alert_to_upstream(alert, downstream_revisions, upstreams, downstream.last_updated)) for alert in downstream.alerts.all())


def classify2(num_alerts):
    """
    Classify AlertSummaries
    Args:
        num_alerts: Int of the number of AlertSummaries to be classified
    """
    alertsummaries = PerformanceAlertSummary.objects.order_by("-last_updated").filter(status=0)[:num_alerts]
    
    # create a list of alertsummaries that contain the word ``merge`` in any of
    # the resultsets
    downstreams = [summary for summary in alertsummaries if summary_is_merge(summary)]
    upstreams = [summary for summary in alertsummaries if summary.id not in [downstream.id for downstream in downstreams]]

    # map each of the downstream alerts to a dictionary containing the alert
    # itself
    result = dict((downstream, classify_possible_downstream2(downstream, upstreams)) for downstream in downstreams)
    for downstream, alerts in result.iteritems():
        print "Downstream id: {0}".format(downstream.id)
        for alert, upstream in alerts.iteritems():
            print "Alert id: {0}, possible upstreams: {1}".format(alert.id,
                    [summary.id for alertsummary in upstream])
    
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
=======
import re
from datetime import timedelta
from treeherder.etl.common import fetch_json
from treeherder.perf.models import PerformanceAlertSummary

def get_result_set_from_hg(repo_url, from_revision, to_revision):
    """
    Args:
        repo_name, revision
        from_revision - a revision
        to_revision - a revision
    Returns a result set dictionaries
    """
    # TODO
    # each repo seems to have a different url, I may have to query itno each
    # repo for the correct url
    hg_url = "{}/json-pushes".format(repo_url)
    return fetch_json(hg_url, {"full": 1,
                               "version": 2,
                               "fromchange": from_revision,
                               "tochange": to_revision})


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
    current_push = summary.push
    prev_push = summary.prev_push
    return is_downstream_resultset(summary.repository.url, current_push.revision, prev_push.revision) 


def get_possible_upstreams(downstream, upstreams):
    """
    Args:
        downsteam - A single AlertSummary
        upstream - A queryset of AlertSummaries that could possibly be upstream

    Return a queryset of AlertSummaries that contain the same performance signature
    as the given downstream, and was created within the last 7 days.
    """
    signature_hashes = [alert.series_signature.signature_hash
                        for alert in downstream.alerts.all()
                        .select_related('series_signature__signature_hash')]
    return upstreams.filter(
            # alerts__series_signature__signature_hash=signature_hashes,
            last_updated__gte=downstream.last_updated - timedelta(days=7))

def is_downstream_resultset(repo_url, from_revision, to_revision):
    """
    Determines whether a resultset given is downstream
    Args:
        repo_name - a Repository
        from_revision - a revision
        to_revision - a revision
    Returns a bool
    """
    try:
        result_set = get_result_set_from_hg(repo_url, from_revision, to_revision)
    except IndexError:
        return False
    else:
        return any([merge_regex(changeset['desc']) for push in result_set['pushes'].values() for changeset in push['changesets']])



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
    downstream_resultsets = get_result_set_from_hg(downstream.repository.url,
                                              downstream.push.revision,
                                              downstream.prev_push.revision)
    upstream_resultsets = [(upstream, get_result_set_from_hg(upstream.repository.url,
                                                        upstream.push.revision,
                                                        upstream.prev_push.revision))
                          for upstream in upstreams]
    return any([])

def classify(num_alerts):
    """
    Classify AlertSumamries
    Args:
        num_alerts - Number of AlertSummaries to classify
    """
    alertsummaries = (PerformanceAlertSummary.objects
                                             .order_by("-last_updated")
                                             .filter(status=0)[:num_alerts])
    return alertsummaries
>>>>>>> Stashed changes
