import json
import os

import responses
from django.conf import settings
from django.core.cache import cache

from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.models import (Commit,
                                     Push)


def test_ingest_hg_pushlog(jm, test_base_dir,
                           test_repository,
                           activate_responses):
    """ingesting a number of pushes should populate result set and revisions"""

    pushlog_path = os.path.join(test_base_dir, 'sample_data', 'hg_pushlog.json')
    with open(pushlog_path) as f:
        pushlog_content = f.read()
    pushlog_fake_url = "http://www.thisismypushlog.com"
    responses.add(responses.GET, pushlog_fake_url,
                  body=pushlog_content, status=200,
                  content_type='application/json')

    process = HgPushlogProcess()

    process.run(pushlog_fake_url, jm.project)

    # should be 10 pushes, 15 revisions
    assert Push.objects.count() == 10
    assert Commit.objects.count() == 15


def test_ingest_hg_pushlog_already_stored(jm, test_base_dir,
                                          test_repository, activate_responses):
    """test that trying to ingest a push already stored doesn't doesn't affect
    all the pushes in the request,
    e.g. trying to store [A,B] with A already stored, B will be stored"""

    pushlog_path = os.path.join(test_base_dir, 'sample_data', 'hg_pushlog.json')
    with open(pushlog_path) as f:
        pushlog_json = json.load(f)
    pushes = pushlog_json['pushes'].values()
    first_push, second_push = pushes[0:2]

    pushlog_fake_url = "http://www.thisismypushlog.com/?full=1&version=2"

    # store the first push only
    first_push_json = json.dumps({"lastpushid": 1, "pushes": {"1": first_push}})
    responses.add(responses.GET, pushlog_fake_url,
                  body=first_push_json, status=200,
                  content_type='application/json',
                  match_querystring=True,
                  )

    process = HgPushlogProcess()
    process.run(pushlog_fake_url, jm.project)

    assert Push.objects.count() == 1

    # store both first and second push
    first_and_second_push_json = json.dumps(
        {"lastpushid": 2, "pushes": {"1": first_push, "2": second_push}}
    )

    responses.add(
        responses.GET,
        pushlog_fake_url + "&startID=1",
        body=first_and_second_push_json,
        status=200, content_type='application/json',
        match_querystring=True)

    process = HgPushlogProcess()

    process.run(pushlog_fake_url, jm.project)

    assert Push.objects.count() == 2


def test_ingest_hg_pushlog_cache_last_push(jm, test_repository,
                                           test_base_dir,
                                           activate_responses):
    """
    ingesting a number of pushes should cache the top revision of the last push
    """

    pushlog_path = os.path.join(test_base_dir, 'sample_data',
                                'hg_pushlog.json')
    with open(pushlog_path) as f:
        pushlog_content = f.read()
    pushlog_fake_url = "http://www.thisismypushlog.com"
    responses.add(responses.GET, pushlog_fake_url, body=pushlog_content,
                  status=200, content_type='application/json')

    process = HgPushlogProcess()
    process.run(pushlog_fake_url, jm.project)

    pushlog_dict = json.loads(pushlog_content)
    pushes = pushlog_dict['pushes']
    max_push_id = max([int(k) for k in pushes.keys()])

    cache_key = "%s:last_push_id" % settings.TREEHERDER_TEST_PROJECT
    assert cache.get(cache_key) == max_push_id


def test_empty_json_pushes(jm, test_base_dir,
                           test_repository,
                           activate_responses):
    """
    Gracefully handle getting an empty list of pushes from json-pushes

    """

    pushlog_fake_url = "http://www.thisismypushlog.com/?full=1&version=2"

    # store the first push only
    empty_push_json = json.dumps({"lastpushid": 123, "pushes": {}})
    responses.add(responses.GET, pushlog_fake_url,
                  body=empty_push_json, status=200,
                  content_type='application/json',
                  match_querystring=True,
                  )

    process = HgPushlogProcess()
    process.run(pushlog_fake_url, jm.project)

    pushes_stored = jm.get_dhub().execute(
        proc="jobs_test.selects.result_set_ids",
        return_type='tuple'
    )

    assert len(pushes_stored) == 0
