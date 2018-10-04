import pytest

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceSignature)
from treeherder.model.models import Push
from treeherder.perf.autoclassify import (classify_downstream,
                                          is_downstream_summary,
                                          is_upstream_summary,
                                          get_result_set_from_hg,
                                          get_possible_upstreams,
                                          find_node,
                                          merge_regex)

def generate_test_data(sample_repository, sample_perf_signature,
                       sample_perf_alert_summary, sample_perf_alert):
    """
    Generate the necessary data for testing
    """
    from treeherder.model.models import RepositoryGroup
    test_repo_group = RepositoryGroup.objects.create(
            name="test",
            description="")

    # sample downstream = # https://treeherder.mozilla.org/perf.html#/alerts?id=4534
    # sample upstream = # https://treeherder.mozilla.org/perf.html#/alerts?id=4521
    # sample unrelated downstream = # # https://treeherder.mozilla.org/perf.html#/alerts?id=4448
    autoland = create_repo(test_repo_group, "autoland", "https://hg.mozilla.org/integration/autoland")
    mozilla_inbound = create_repo(test_repo_group, "mozilla-inbound", "https://hg.mozilla.org/integration/mozilla-inbound")

    # create downstream AlertSummary
    autoland_downstream_push = clone_object(
            sample_perf_alert_summary.push,
            repository=autoland,
            revision="406e7872f7d7db354e8afd19906d4e76ab9392d6"
            )
    autoland_downstream_prev_push = clone_object(
            sample_perf_alert_summary.prev_push,
            repository=autoland,
            revision="2a1fc85aecac9cd7f7a18f38d33eaa1fffb121aa"
            )
    autoland_downstream_summary = clone_object(
            sample_perf_alert_summary,
            repository=autoland,
            push=autoland_downstream_push,
            prev_push=autoland_downstream_prev_push
            )
    autoland_perf_alert = clone_object(
            sample_perf_alert,
            summary=autoland_downstream_summary
            )

    # create upstream AlertSummary
    mozilla_inbound_perf_upstream_push = clone_object(
            sample_perf_alert_summary.push,
            repository = mozilla_inbound,
            revision="3460a22b7c62160047431f88eaca952f8a0e0624")
    mozilla_inbound_perf_upstream_prev_push = clone_object(
            sample_perf_alert_summary.prev_push,
            repository=mozilla_inbound,
            revision="6e02d48ef1226c6f8c7504c05dac113794d65f07")
    mozilla_inbound_perf_alert_summary = clone_object(
            sample_perf_alert_summary,
            repository=mozilla_inbound,
            push = mozilla_inbound_perf_upstream_push,
            prev_push = mozilla_inbound_perf_upstream_prev_push)
    mozilla_inbound_perf_alert = clone_object(
            sample_perf_alert,
            summary=mozilla_inbound_perf_alert_summary
            )

    # create unrelated AlertSummary
    autoland_unrelated_downstream_push = clone_object(
            sample_perf_alert_summary.push,
            repository=autoland,
            revision_hash=None,
            revision="a8e20bf36959426f0a6eb4b5df29ef3dd85ad4bd")
    autoland_unrelated_downstream_prev_push = clone_object(
            sample_perf_alert_summary.prev_push,
            repository=autoland,
            revision_hash=None,
            revision="3976b04bf08a4442eb75cace5ad4899ca0eb0ced"
            )
    autoland_unrelated_downstream_summary = clone_object(
            sample_perf_alert_summary,
            repository=autoland,
            push=autoland_unrelated_downstream_push,
            prev_push=autoland_unrelated_downstream_prev_push)
    autoland_unrelated_alert = clone_object(
            sample_perf_alert,
            summary=autoland_unrelated_downstream_summary
            )

    

def create_repo(repo_group, name, url):
    """
    Create a repository
    """
    from treeherder.model.models import Repository
    return Repository.objects.create(
           dvcs_type="hg",
           name=name,
           url=url,
           active_status="active",
           codebase="gecko",
           repository_group = repo_group,
           description = "",
           performance_alerts_enabled=True
            )


def set_kwargs(item, **kwargs):
    for key, value in kwargs.items():
        setattr(item, key, value)


def clone_object(item, **kwargs):
    item.pk = None
    set_kwargs(item, **kwargs)
    item.save()
    return item


def test_is_downstream_summary(test_repository, test_perf_signature,
                              test_perf_alert_summary, test_perf_alert):
    """
    Verifies that the function for retrieving data regarding a resultset works
    """
    generate_test_data(test_repository, test_perf_signature, test_perf_alert_summary, test_perf_alert)

    summaries = PerformanceAlertSummary.objects.all()
    # assert is_downstream_summary(summaries[0]) == True
    assert is_downstream_summary(summaries[1]) == True
    assert is_downstream_summary(summaries[2]) == False
    assert is_downstream_summary(summaries[3]) == True


def test_merge_regex():
    """Verifies that regex for checking the substring ``merge`` works"""

    assert merge_regex("Merge mozilla-central to autoland ") == True
    assert merge_regex("merge fx-team to mozilla-central a=merge") == True
    assert merge_regex("Theme preview is not working. r=sebastian") == False


def test_get_possible_upstreams(test_repository, test_perf_signature,
                              test_perf_alert_summary, test_perf_alert):
    """
    Verifies that possible upstreams is working
    """
    # generate test data. Since the performance alert signatures have not been
    # changed, they should all have the same signature, and the upstream alert
    # summary should be common for all downstreams
    generate_test_data(test_repository, test_perf_signature, test_perf_alert_summary, test_perf_alert)

    summaries = PerformanceAlertSummary.objects.all()[1:]
    assert summaries.count() == 3

    downstreams = filter(is_downstream_summary, summaries)
    upstream_ids = [summary.id for summary in summaries if summary not in downstreams]
    upstreams = PerformanceAlertSummary.objects.filter(id__in=upstream_ids)

    assert len(upstreams) == 1
    assert len(downstreams) == 2

    assert len(get_possible_upstreams(downstreams[0], upstreams)) == 1
    assert len(get_possible_upstreams(downstreams[1], upstreams)) == 0



def test_is_upstream_summary(test_repository, test_perf_signature,
                              test_perf_alert_summary, test_perf_alert):
    """
    Verifies that is_upstream_summary works
    """
    generate_test_data(test_repository, test_perf_signature, test_perf_alert_summary, test_perf_alert)
    summaries = PerformanceAlertSummary.objects.all()[1:]
    assert is_upstream_summary(get_result_set_from_hg(summaries[0]),
                               get_result_set_from_hg(summaries[1])) == True
    assert is_upstream_summary(get_result_set_from_hg(summaries[0]),
                               get_result_set_from_hg(summaries[2])) == False


def test_classify_downstream(test_repository, test_perf_signature,
                              test_perf_alert_summary, test_perf_alert):
    generate_test_data(test_repository, test_perf_signature, test_perf_alert_summary, test_perf_alert)
    summaries = PerformanceAlertSummary.objects.all()[1:]

    classify_downstream(summaries[0], [summaries[1]])
    classify_downstream(summaries[2], [summaries[1]])
