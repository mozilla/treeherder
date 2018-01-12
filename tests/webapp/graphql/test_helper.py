import json

import pytest
from mock import Mock

from treeherder.model.models import Push
from treeherder.webapp.graphql import helpers


@pytest.fixture
def query_node(sample_data):
    with open(sample_data.get_graphql_path("query_node.json")) as f:
        return json.load(f)


def test_collect_fields(query_node):
    fields = helpers.collect_fields(query_node)
    exp_fields = {"jobs", "edges", "node", "failureClassification", "name",
                  "jobType", "symbol", "jobGroup"}
    assert exp_fields == fields


def test_optimize(query_node, push_stored):
    qs = Push.objects.filter(revision=push_stored[0]["revision"])
    field_map = {
        "jobType": ("job_type", "select"),
        "jobGroup": ("job_group", "select"),
        "failureClassification": ("failure_classification", "prefetch"),
    }
    qs = helpers.optimize(qs, query_node, field_map)

    assert ('failure_classification',) == qs._prefetch_related_lookups
    assert {'job_type': {}, 'job_group': {}} == qs.query.select_related


class TestOptimizedFilterConnectionField(object):

    def test_merge_querysets_raises_if_both_querysets_low_mark(self):
        # two querysets with queryset.query.low_mark > 0
        qset1 = Mock(query=Mock(high_mark=1, low_mark=1))
        qset2 = Mock(query=Mock(high_mark=0, low_mark=1))

        with pytest.raises(ValueError) as exc:
            helpers.OptimizedFilterConnectionField.merge_querysets(
                default_queryset=qset1,
                queryset=qset2
            )
        exc.match(
            r'Received two sliced querysets \(low mark\) in the connection.+'
            r'please slice only in one\.'
        )

    def test_merge_querysets_raises_if_both_querysets_high_mark(self):
        # two querysets with queryset.query.high_mark > 0
        qset1 = Mock(query=Mock(high_mark=1, low_mark=1))
        qset2 = Mock(query=Mock(high_mark=1, low_mark=0))

        with pytest.raises(ValueError) as exc:
            helpers.OptimizedFilterConnectionField.merge_querysets(
                default_queryset=qset1,
                queryset=qset2
            )
        exc.match(
            r'Received two sliced querysets \(high mark\) in the connection.+'
            r'please slice only in one\.'
        )
