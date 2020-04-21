import pytest

from treeherder.perf.backfill_tool import BackfillTool
from treeherder.perf.exceptions import CannotBackfill
from treeherder.services.taskcluster import TaskclusterModel


# BackfillTool
def test_backfilling_job_from_try_repo_raises_exception(job_from_try):
    backfill_tool = BackfillTool(
        TaskclusterModel('https://fakerooturl.org', 'FAKE_CLIENT_ID', 'FAKE_ACCESS_TOKEN')
    )

    with pytest.raises(CannotBackfill):
        backfill_tool.backfill_job(job_from_try.id)
