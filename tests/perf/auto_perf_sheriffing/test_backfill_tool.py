import pytest

from treeherder.perf.auto_perf_sheriffing.backfill_tool import BackfillTool
from treeherder.perf.exceptions import CannotBackfillError
from treeherder.services.taskcluster import TaskclusterModelNullObject


class TestBackfillTool:
    FAKE_ROOT_URL = "https://fakerooturl.org"
    FAKE_OPTIONS = (FAKE_ROOT_URL, "FAKE_CLIENT_ID", "FAKE_ACCESS_TOKEN")
    MISSING_JOB_ID = "12830123912"

    def test_backfilling_missing_job_errors_out(self, db):
        backfill_tool = BackfillTool(TaskclusterModelNullObject(*self.FAKE_OPTIONS))
        with pytest.raises(LookupError):
            backfill_tool.backfill_job(self.MISSING_JOB_ID)

    def test_backfilling_job_from_try_repo_by_id_raises_exception(self, job_from_try):
        backfill_tool = BackfillTool(TaskclusterModelNullObject(*self.FAKE_OPTIONS))

        with pytest.raises(CannotBackfillError):
            backfill_tool.backfill_job(job_from_try.id)

    def test_backfilling_job_from_try_repo_raises_exception(self, job_from_try):
        backfill_tool = BackfillTool(TaskclusterModelNullObject(*self.FAKE_OPTIONS))

        with pytest.raises(CannotBackfillError):
            backfill_tool.backfill_job(job_from_try)
