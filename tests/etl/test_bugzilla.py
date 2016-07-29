import pytest

from treeherder.etl.bugzilla import BzApiBugProcess
from treeherder.model.models import Bugscache


@pytest.mark.django_db(transaction=True)
def test_bz_api_process(mock_bugzilla_api_request):
    process = BzApiBugProcess()
    process.run()

    # the number of rows inserted should equal to the number of bugs
    assert Bugscache.objects.count() == 16

    # test that a second ingestion of the same bugs doesn't insert new rows
    process.run()
    assert Bugscache.objects.count() == 16
