# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from datetime import datetime
import logging

import requests
from treeherder.model.derived import JobsModel
from django.conf import settings

logger = logging.getLogger(__name__)


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
            "comment": "Bug {0}".format(self.bug_id),
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
        logger.info("Sending data to %s: %s", tbpl_url, self.body)
        r = requests.post(tbpl_url, data=self.body)
        r.raise_for_status()


class BugzillaBugRequest(object):

    def __init__(self, project, job_id, bug_id):
        self.project = project
        self.job_id = job_id
        self.bug_id = bug_id
        self.body = ""

    def generate_request_body(self):
        """
        Create the data structure required by tbpl's submitBugzillaComment.php script
        This is triggered by a new bug-job association.
        """
        jm = JobsModel(self.project)
        try:
            job = jm.get_job(self.job_id)[0]
            failures_artifacts = jm.get_job_artifact_list(0, 1, {
                'job_id': set([('=', job['id'])]),
                'name': set([('=', 'Bug suggestions')]),
            })
            error_lines = []
            for artifact in failures_artifacts:
                # a bug suggestion aritfact looks like this:
                # [{ "search": "my-error-line", "bugs": ....}]
                error_lines += [line["search"] for line in artifact["blob"]]
            bug_job_map = jm.get_bug_job_map_detail(self.job_id, self.bug_id)

            revision_list = jm.get_resultset_revisions_list(
                job["result_set_id"]
            )

            buildapi_info = jm.get_job_artifact_list(0, 1, {
                'job_id': set([("=", self.job_id)]),
                'name': set([("=", "buildapi")])
            })
        finally:
            jm.disconnect()

        who = bug_job_map["who"]\
            .replace("@", "[at]")\
            .replace(".", "[dot]")
        submit_date = datetime.fromtimestamp(bug_job_map["submit_timestamp"])\
            .replace(microsecond=0)\
            .isoformat()

        job_description = {
            'repository': self.project,
            'who': who,
            'submit_timestamp': submit_date,
            'log': "{0}{1}/logviewer.html#?repo={2}&job_id={3}".format(
                settings.SITE_URL,
                settings.UI_PREFIX,
                self.project,
                self.job_id
            ),
            'machine': job["machine_name"],
            'revision': revision_list[0]["revision"],
        }

        if buildapi_info:
            job_description['buildname'] = buildapi_info[0]["blob"]["buildername"]


        body_comment = '\n'.join(
            ["{0}: {1}".format(k, v) for k, v in job_description.items()])

        body_comment += '\n\n'
        body_comment += '\n'.join(error_lines)

        self.body = {
            "id": self.bug_id,
            "comment": body_comment
        }

    def send_request(self):
        """
        send request to tbpl host
        """
        if not self.body:
            self.generate_request_body()
        tbpl_host = settings.TBPL_HOST
        tbpl_script = "/php/submitBugzillaComment.php"
        tbpl_url = "".join([tbpl_host, tbpl_script])
        logger.info("Sending data to %s: %s", tbpl_url, self.body)
        r = requests.post(tbpl_url, data=self.body)
        r.raise_for_status()
