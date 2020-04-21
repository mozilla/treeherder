import datetime
import json
import os

import pytest
import responses

from treeherder.config import settings
from treeherder.model.models import Push
from treeherder.push_health.usage import get_latest, get_peak, get_usage


@pytest.fixture
def push_usage(test_base_dir):
    usage_path = os.path.join(test_base_dir, 'sample_data', 'push_usage_data.json')
    with open(usage_path) as f:
        return json.load(f)


def test_peak(push_usage):

    peak = get_peak(push_usage['facets'][0])
    assert peak['needInvestigation'] == 149.0
    assert peak['time'] == 1584035553


def test_latest(push_usage):
    latest = get_latest(push_usage['facets'][0])
    assert latest['needInvestigation'] == 30.0
    assert latest['time'] == 1584042753


@responses.activate
def test_get_usage(push_usage, test_repository):
    nrql = "SELECT%20max(needInvestigation)%20FROM%20push_health_need_investigation%20FACET%20revision%20SINCE%201%20DAY%20AGO%20TIMESERIES%20where%20repo%3D'{}'%20AND%20appName%3D'{}'".format(
        'try', 'treeherder-prod'
    )
    new_relic_url = '{}?nrql={}'.format(settings.NEW_RELIC_INSIGHTS_API_URL, nrql)

    responses.add(
        responses.GET,
        new_relic_url,
        body=json.dumps(push_usage),
        status=200,
        content_type='application/json',
        match_querystring=True,
    )

    # create the Pushes that match the usage response
    for rev in [
        '4c45a777949168d16c03a4cba167678b7ab65f76',
        '1cd5f1062ce081636af8083eb5b87e45d0f03d01',
        'c73645027199ac3e092002452b436dde461bbe28',
        'b6e5cd6373370c40d315b0e266c6c3e9aa48ae12',
    ]:
        Push.objects.create(
            revision=rev,
            repository=test_repository,
            author='phydeaux@dog.org',
            time=datetime.datetime.now(),
        )

    usage = get_usage()
    facet = usage[0]

    assert len(usage) == 4
    assert facet['push']['revision'] == '4c45a777949168d16c03a4cba167678b7ab65f76'
    assert facet['peak']['needInvestigation'] == 149.0
    assert facet['latest']['needInvestigation'] == 30.0
