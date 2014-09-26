import os
import responses
from treeherder.etl.pushlog import HgPushlogProcess


def test_ingest_hg_pushlog(jm, initial_data, test_base_dir,
                           test_repository, mock_post_json_data, activate_responses):
    """ingesting a number of pushes should populate result set and revisions"""

    pushlog_path = os.path.join(test_base_dir, 'sample_data', 'hg_pushlog.json')
    pushlog_content = open(pushlog_path).read()
    pushlog_fake_url = "http://www.thisismypushlog.com"
    responses.add(responses.GET, pushlog_fake_url,
                  body=pushlog_content, status=200,
                  content_type='application/json')

    process = HgPushlogProcess()

    process.run(pushlog_fake_url, jm.project)

    pushes_stored = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.result_set_ids",
        return_type='tuple'
    )

    assert len(pushes_stored) == 10

    revisions_stored = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.revision_ids",
        return_type='tuple'
    )

    assert len(revisions_stored) == 15

    jm.disconnect()
