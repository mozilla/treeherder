import json
import os

import pytest

from treeherder.etl.bugzilla import BzApiBugProcess
from treeherder.model.models import Bugscache


@pytest.fixture
def mock_extract(monkeypatch):
    """
    mock BzApiBugProcess._get_bz_source_url() to return
    a local sample file
    """
    def extract(obj, url):
        tests_folder = os.path.dirname(os.path.dirname(__file__))
        bug_list_path = os.path.join(
            tests_folder,
            "sample_data",
            "bug_list.json"
        )
        with open(bug_list_path) as f:
            return json.loads(f.read())

    monkeypatch.setattr(BzApiBugProcess,
                        'extract',
                        extract)


@pytest.mark.django_db(transaction=True)
def test_bz_api_process(mock_extract):
    process = BzApiBugProcess()
    process.run()

    # the number of rows inserted should equal to the number of bugs
    assert Bugscache.objects.count() == 15

    # test that a second ingestion of the same bugs doesn't insert new rows
    process.run()
    assert Bugscache.objects.count() == 15
