import pytest
from mock import patch

from treeherder.seta.high_value_jobs import get_high_value_jobs
from treeherder.seta.runnable_jobs import RunnableJobsClient


@pytest.mark.django_db()
@patch.object(RunnableJobsClient, '_query_latest_gecko_decision_task_id')
def test_get_high_value_jobs(query_latest_task_id,
                             tc_latest_gecko_decision_index, fifthteen_jobs_with_notes, failures_fixed_by_commit):
    query_latest_task_id.return_value = tc_latest_gecko_decision_index
    get_high_value_jobs(failures_fixed_by_commit)
