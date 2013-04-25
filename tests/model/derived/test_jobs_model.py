import json
import difflib
import pprint


from .sample_data_generator import job_json


def test_unicode(jm):
    """Unicode representation of a ``JobModel`` is the project name."""
    assert unicode(jm) == unicode(jm.project)


def test_disconnect(jm):
    """test that your model disconnects"""

    # establish the connection to jobs.
    jm._get_last_insert_id()
    # establish the connection to objectstore
    jm.retrieve_job_data(limit=1)

    jm.disconnect()
    for src in jm.sources.itervalues():
        assert src.dhub.connection["master_host"]["con_obj"].open is False


def test_ingest_single_sample_job(jm, sample_data):
    """Process all job structures in the job_data.txt file"""
    blob = sample_data.job_data[0]
    jm.store_job_data(json.dumps(blob))
    job_id = jm.process_objects(1)[0]

    job_dict = JobDictBuilder(jm, job_id).as_dict()

    assert blob["jobs"][0] == job_dict, diff_dict(blob["jobs"][0], job_dict)

    # print json.dumps(blob, indent=4)
    # print json.dumps(job_dict, indent=4)

    complete_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.complete")[0]["complete_count"]
    loading_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert complete_count == 2
    assert loading_count == 0


class JobDictBuilder(object):

    def __init__(self, jm, job_id):
        self.jm = jm
        self.job_id = job_id

    def as_dict(self):
        job = self.jm.get_jobs_dhub().execute(
            proc="jobs_test.selects.job",
            placeholders=[self.job_id],
            key_column="id",
            return_type='dict',
        )[self.job_id]

        job["artifact"] = self._get_artifact()
        job["log_references"] = self._get_logs()
        job["option_collection"] = self._get_option_collection(
            job["option_collection_id"])
        del(job["option_collection_id"])
        job["machine_platform"] = self._get_machine_platform(
            job["machine_platform_id"])
        del(job["machine_platform_id"])
        return self._unicode_keys(job)

    def _get_option_collection(self, oc_id):
        # need this in refdata model
        #oc = self.jm.refdata_model.get_option_collection(oc_id)
        return "NotImplementedYet"

    def _get_machine_platform(self, mp_id):
        # need this in refdata model
        #mp = self.jm.refdata_model.get_machine_platform(mp_id)
        return "NotImplementedYet"

    def _get_logs(self):
        logs = self.jm.get_jobs_dhub().execute(
            proc="jobs_test.selects.job_log_urls",
            placeholders=[self.job_id],
            key_column="id",
            return_type='dict',
        )

        log_values = []
        for log in logs.values():
            del(log["active_status"])
            del(log["id"])
            del(log["job_id"])
            log_values.append(self._unicode_keys(log))

        return log_values

    def _get_artifact(self):
        artifacts = self.jm.get_jobs_dhub().execute(
            proc="jobs_test.selects.job_artifacts",
            placeholders=[self.job_id],
            key_column="id",
            return_type='dict',
        )
        if not len(artifacts):
            artifacts = {}
        else:
            artifacts = artifacts.values()
        return artifacts

    def _unicode_keys(self, d):
        return dict([(unicode(k), v) for k, v in d.items()])


def diff_dict(d1, d2):
    """Compare two dicts, the same way unittest.assertDictEqual does"""
    diff = ('\n' + '\n'.join(difflib.ndiff(
       pprint.pformat(d1).splitlines(),
       pprint.pformat(d2).splitlines())))
    return diff
