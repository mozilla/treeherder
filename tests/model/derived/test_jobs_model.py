import json
import difflib
import pprint
import pytest

slow = pytest.mark.slow

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
    assert not jm.get_os_dhub().connection["master_host"]["con_obj"].open
    assert not jm.get_jobs_dhub().connection["master_host"]["con_obj"].open


def do_job_ingestion(jm, job_data):
    """
    Test ingesting job blobs.  ``job_data`` maybe different sizes.

    Process each job structure in the job_data and verify.

    This rebuilds the JSON blob (for the most part) and compares that
    everything was stored correctly.

    """
    for blob in job_data:
        jm.store_job_data(json.dumps(blob))
        jobs = jm.process_objects(1)
        assert len(jobs) == 1
        job_id = jobs[0]

        # verify the job data
        exp_job = clean_job_blob_dict(blob["job"])
        act_job = JobDictBuilder(jm, job_id).as_dict()
        assert exp_job == act_job, diff_dict(exp_job, act_job)

        # verify the source data
        try:
            exp_src = clean_source_blob_dict(blob["sources"][0])

            # import time
            # time.sleep(120)
            act_src = SourceDictBuilder(jm, job_id).as_dict()
            assert exp_src == act_src, diff_dict(exp_src, act_src)
        except StopIteration as e:
            print json.dumps(act_job, indent=4)
            assert False

    complete_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.complete")[0]["complete_count"]
    loading_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert complete_count == len(job_data)
    assert loading_count == 0


def test_ingest_single_sample_job(jm, sample_data):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    do_job_ingestion(jm, job_data)


@slow
def test_ingest_all_sample_jobs(jm, sample_data):
    """
    Process each job structure in the job_data.txt file and verify.

    """
    job_data = sample_data.job_data
    do_job_ingestion(jm, job_data)


class SourceDictBuilder(object):
    """Given a ``job_id``, rebuild the dictionary the source came from."""

    def __init__(self, jm, job_id):
        self.jm = jm
        self.job_id = job_id

    def as_dict(self):
        source = self.jm.get_jobs_dhub().execute(
            proc="jobs_test.selects.job_source",
            placeholders=[self.job_id],
            return_type="iter"
        ).next()

        source["repository"] = self._get_repository(
            source["repository_id"])
        del(source["repository_id"])

        return unicode_keys(source)

    def _get_repository(self, obj_id):
        obj = self.jm.refdata_model.get_row_by_id(
            "repository",
            obj_id,
        ).get_column_data("name")
        return obj


class JobDictBuilder(object):
    """Given a ``job_id``, rebuild the dictionary the job came from."""

    def __init__(self, jm, job_id):
        self.jm = jm
        self.job_id = job_id

    def as_dict(self):
        job = self.jm.get_job(self.job_id)

        job["artifact"] = self._get_artifact()
        job["log_references"] = self._get_logs()

        job["option_collection"] = self._get_option_collection(
            job["option_collection_id"])
        del(job["option_collection_id"])

        job["machine_platform"] = self._get_machine_platform(
            job["machine_platform_id"])
        del(job["machine_platform_id"])

        job["build_platform"] = self._get_build_platform(
            job["build_platform_id"])
        del(job["build_platform_id"])

        job["machine"] = self._get_machine(
            job["machine_id"])
        del(job["machine_id"])

        job["product_name"] = self._get_product(
            job["product_id"])
        del(job["product_id"])

        job["name"] = self._get_name(
            job["job_type_id"])
        del(job["job_type_id"])

        del(job["id"])
        del(job["active_status"])
        del(job["result_set_id"])

        if not job["job_coalesced_to_guid"]:
            del(job["job_coalesced_to_guid"])

        return unicode_keys(job)

    def _get_option_collection(self, obj_id):
        option_id = self.jm.refdata_model.get_row_by_id(
            "option_collection",
            obj_id,
        ).get_column_data("option_id")
        obj = self.jm.refdata_model.get_row_by_id(
            "option",
            option_id,
        ).next()
        return {unicode(obj["name"]): True}

    def _get_machine_platform(self, obj_id):
        obj = self.jm.refdata_model.get_row_by_id(
            "machine_platform",
            obj_id,
        ).next()
        del(obj["active_status"])
        del(obj["id"])
        return unicode_keys(obj)

    def _get_build_platform(self, obj_id):
        obj = self.jm.refdata_model.get_row_by_id(
            "build_platform",
            obj_id,
        ).next()
        del(obj["active_status"])
        del(obj["id"])
        return unicode_keys(obj)

    def _get_machine(self, obj_id):
        obj = self.jm.refdata_model.get_row_by_id(
            "machine",
            obj_id,
        ).get_column_data("name")
        return obj

    def _get_product(self, obj_id):
        obj = self.jm.refdata_model.get_row_by_id(
            "product",
            obj_id,
        ).get_column_data("name")
        return obj

    def _get_name(self, obj_id):
        job_type = self.jm.refdata_model.get_row_by_id(
            "job_type",
            obj_id,
        ).next()
        job_group = self.jm.refdata_model.get_row_by_id(
            "job_group",
            job_type["job_group_id"],
        ).get_column_data("name")
        if job_type["name"]:
            return u"{0}-{1}".format(
                job_group,
                job_type["name"],
            )
        else:
            return job_group

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
            log_values.append(unicode_keys(log))

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


def unicode_keys(d):
    return dict([(unicode(k), v) for k, v in d.items()])


def clean_source_blob_dict(src):
    """Fix a few fields so they're easier to compare"""
    src["commit_timestamp"] = long(src["commit_timestamp"])
    src["push_timestamp"] = long(src["push_timestamp"])
    return src


def clean_job_blob_dict(job):
    """Fix a few fields so they're easier to compare"""
    job["start_timestamp"] = long(job["start_timestamp"])
    job["submit_timestamp"] = long(job["submit_timestamp"])
    job["end_timestamp"] = long(job["end_timestamp"])
    job["result"] = unicode(job["result"])

    # @@@ we don't keep track of VM'ness?
    try:
        del(job["machine_platform"]["vm"])
    except KeyError:
        pass  # oh, that's ok
    try:
        del(job["build_platform"]["vm"])
    except KeyError:
        pass  # oh, that's ok

    return job


def diff_dict(d1, d2):
    """Compare two dicts, the same way unittest.assertDictEqual does"""
    diff = ('\n' + '\n'.join(difflib.ndiff(
       pprint.pformat(d1).splitlines(),
       pprint.pformat(d2).splitlines())))
    return diff
