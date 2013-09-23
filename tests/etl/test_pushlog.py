import os
from treeherder.etl.pushlog import HgPushlogProcess


def test_ingest_hg_pushlog(jm, initial_data, test_base_dir,
                           test_repository, mock_post_json_data):
    """ingesting a number of pushes should populate result set and revisions"""

    pushlog = os.path.join(test_base_dir, 'sample_data', 'hg_pushlog.json')
    process = HgPushlogProcess()

    process.run("file://{0}".format(pushlog), jm.project)

    pushes_stored = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.result_set",
        return_type='tuple'
    )

    assert len(pushes_stored) == 10

    revisions_stored = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.revisions",
        return_type='tuple'
    )

    assert len(revisions_stored) == 15
