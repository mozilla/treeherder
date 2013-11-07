import pytest
import os

from django.conf import settings

from treeherder.etl.bugzilla import BzApiBugProcess
from treeherder.model.derived import RefDataManager

@pytest.fixture
def mock_bz_bugs_url(monkeypatch):
    """
    mock BzApiBugProcess._get_bz_source_url() to return
    a local sample file
    """
    def _get_bugs_url(obj, last_changed):
        tests_folder = os.path.dirname(os.path.dirname(__file__))
        bug_list_path =  os.path.join(
            tests_folder,
            "sample_data",
            "bug_list.json"
        )
        return "file://{0}".format(bug_list_path)


    monkeypatch.setattr(BzApiBugProcess,
                        '_get_bz_source_url',
                        _get_bugs_url)


def test_bz_api_process(mock_bz_bugs_url, refdata):
    process = BzApiBugProcess()
    process.run()

    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_bugscache',
        return_type='tuple'
    )
    # the number of rows inserted should equal to the number of bugs
    assert len(row_data) == 10

    # test that a second ingestion of the same bugs doesn't insert new rows
    process.run()
    assert len(row_data) == 10