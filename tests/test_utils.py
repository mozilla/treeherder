import difflib
import pprint
import json

from treeherder.model import utils
from sampledata import SampleData


def diff_dict(d1, d2):
    """Compare two dicts, the same way unittest.assertDictEqual does"""
    diff = ('\n' + '\n'.join(difflib.ndiff(
            pprint.pformat(d1).splitlines(),
            pprint.pformat(d2).splitlines())))
    return diff


def do_job_ingestion(jm, job_data, verify_data=True):
    """
    Ingest ``job_data`` which will be JSON job blobs.

    ``verify_data`` - whether or not to run the ingested jobs
                      through the verifier.
    """
    for blob in job_data:
        job_guid = blob['job']['job_guid']
        jm.store_job_data(json.dumps(blob), job_guid)
        jm.process_objects(1)

        if verify_data:
            # verify the job data
            exp_job = clean_job_blob_dict(blob["job"])
            act_job = JobDictBuilder(jm, job_guid).as_dict()
            assert exp_job == act_job, diff_dict(exp_job, act_job)

            # verify the source data
            exp_src = clean_source_blob_dict(blob["sources"][0])
            act_src = SourceDictBuilder(jm, job_guid).as_dict()
            assert exp_src == act_src, diff_dict(exp_src, act_src)

    complete_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.complete")[0]["complete_count"]
    loading_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert complete_count == len(job_data)
    assert loading_count == 0


def load_exp(filename):
    """Load in an expected result json and return as an obj."""
    exp_str = open(SampleData().get_log_path(filename)).read()
    exp_json = json.loads(exp_str)
    return exp_json


class SourceDictBuilder(object):
    """Given a ``job_id``, rebuild the dictionary the source came from."""

    def __init__(self, jm, job_guid):
        self.jm = jm
        self.job_guid = job_guid
        job_data = self.jm.get_jobs_dhub().execute(
            proc="jobs_test.selects.row_by_guid",
            placeholders=[self.job_guid],
            return_type="iter"
        ).next()
        self.job_id = job_data['id']

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

    def __init__(self, jm, job_guid):
        self.jm = jm
        self.job_guid = job_guid
        job_data = self.jm.get_jobs_dhub().execute(
            proc="jobs_test.selects.row_by_guid",
            placeholders=[self.job_guid],
            return_type="iter"
        ).next()
        self.job_id = job_data['id']

    def as_dict(self):
        job = self.jm.get_job(self.job_id)

        job["artifact"] = self._get_artifact()
        job["log_references"] = self._get_logs()

        job["option_collection"] = self._get_option_collection(
            job["option_collection_hash"])
        del(job["option_collection_hash"])

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

    def _get_option_collection(self, option_collection_hash):
        """
        Needs to work with hash.  Get row by id won't work anymore.
        probably need to a new getter where it gets the option id
        but the hash means there's possibly more than one option.
        maybe I need mauro to make a splitter get method?
        """
        option_iter = self.jm.refdata_model.get_option_names(
            option_collection_hash)
        options = {}
        for name_dict in option_iter:
            options[name_dict["name"]] = True

        return options

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
        artifact = self.jm.get_jobs_dhub().execute(
            proc="jobs_test.selects.job_artifact",
            placeholders=[self.job_id],
            key_column="id",
            return_type='dict',
        )
        if not len(artifact):
            artifact = {}
        else:
            artifact = artifact[self.job_id]
            del(artifact["active_status"])
            del(artifact["id"])
            del(artifact["job_id"])

        return unicode_keys(artifact)


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

    # move artifact logs to log_references area for comparison
    try:
        artlog = job["artifact"]["log_urls"]
        job["log_references"].extend(artlog)
        del(job["artifact"]["log_urls"])
    except KeyError:
        pass  # no problem

    # @@@ we don't keep track of VM'ness?
    try:
        del(job["machine_platform"]["vm"])
    except KeyError:
        pass  # no problem
    try:
        del(job["build_platform"]["vm"])
    except KeyError:
        pass  # no problem

    return job
