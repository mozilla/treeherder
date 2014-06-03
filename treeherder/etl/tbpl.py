from datetime import datetime
import requests
from treeherder.model.derived import JobsModel
from treeherder.model.models import FailureClassification
from django.conf import settings


class OrangeFactorBugRequest(object):

    def __init__(self, project, job_id, bug_id, submit_timestamp, who):
        self.project = project
        self.job_id = job_id
        self.bug_id = bug_id
        self.submit_timestamp = submit_timestamp
        self.who = who
        self.body = {}

    def generate_request_body(self):
        """
        Create the data structure required by tbpl's starcomment.php script
        """
        jm = JobsModel(self.project)

        try:
            buildapi_artifact = jm.get_job_artifact_list(0, 1, {
                'job_id': set([("=", self.job_id)]),
                'name': set([("=", "buildapi")])
            })[0]
            job_data = jm.get_job(self.job_id)[0]
            option_collection = jm.refdata_model.get_all_option_collections()
            revision_list = jm.get_resultset_revisions_list(job_data["result_set_id"])
        finally:
            jm.disconnect()

        self.body = {
            "buildname": buildapi_artifact["blob"]["buildername"],
            "machinename": job_data["machine_name"],
            "os": job_data["platform"],
            # I'm using the request time date here, as start time is not
            # available for pending jobs
            "date": datetime.fromtimestamp(
                int(job_data["submit_timestamp"])).strftime("%Y-%m-%d"),
            "type": job_data["job_type_name"],
            "buildtype": option_collection[
                job_data["option_collection_hash"]
            ]["opt"],
            "starttime": int(job_data["start_timestamp"]),
            # "logfile": "",
            "tree": self.project,
            "rev": revision_list[0]["revision"],
            "comment": "Bug {}".format(self.bug_id),
            "who": self.who,
            "timestamp": self.submit_timestamp,
            "logfile": "00000000"
        }

    def send_request(self):
        """
        send request to tbpl host
        """
        tbpl_host = settings.TBPL_HOST
        tbpl_script = "/php/starcomment.php"
        tbpl_url = "".join([tbpl_host, tbpl_script])
        r = requests.post(tbpl_url, data=self.body)
        r.raise_for_status()


class TbplBugRequest(object):

    def __init__(self, project, job_id, who, bug_id=None, classification_id=None, note=None):
        self.project = project
        self.job_id = job_id
        self.bug_id = bug_id
        self.note = note
        self.classification_id = classification_id
        self.who = who
        self.body = {}

    def generate_request_body(self):
        """
        Create the data structure required by tbpl's submitBuildStar.php script
        It's used by both the bug_job_map endpoint and the job note endpoint.
        """
        jm = JobsModel(self.project)
        try:
            buildapi_artifact = jm.get_job_artifact_list(0, 1, {
                'job_id': set([("=", self.job_id)]),
                'name': set([("=", "buildapi_complete")])
            })[0]
            job_data = jm.get_job(self.job_id)[0]
        finally:
            jm.disconnect()

        note = ""
        if self.bug_id:
            note = "Bug {}".format(self.bug_id)
        if self.classification_id:
            if note:
                note += " - "
            note += FailureClassification.objects.get(
                id=self.classification_id).name
            if self.note:
                if note:
                    note += " - "
                note += self.note

        self.body = {
            "id": buildapi_artifact["blob"]["id"],
            "machinename": job_data["machine_name"],
            "starttime": int(job_data["start_timestamp"]),
            "note": note,
            "who": self.who
        }

    def send_request(self):
        """
        send request to tbpl host
        """
        tbpl_host = settings.TBPL_HOST
        tbpl_script = "/php/submitBuildStar.php"
        tbpl_url = "".join([tbpl_host, tbpl_script])
        r = requests.post(tbpl_url, data=self.body)
        r.raise_for_status()