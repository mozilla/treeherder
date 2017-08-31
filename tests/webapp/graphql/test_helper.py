import json

import pytest

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
