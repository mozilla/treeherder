# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from datetime import datetime
import logging

import json
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
        Create the data structure that will be sent to ElasticSearch.
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
            # Intentionally using strings for starttime, bug, timestamp for compatibility
            # with TBPL's legacy output format.
            "starttime": str(job_data["start_timestamp"]),
            "tree": self.project,
            "rev": revision_list[0]["revision"],
            "bug": str(self.bug_id),
            "who": self.who,
            "timestamp": str(self.submit_timestamp),
            "logfile": "00000000"
        }

    def send_request(self):
        """
        Send request to ElasticSearch.
        """
        es_host = settings.ES_HOST
        es_endpoint = "/bugs/bug_info/"
        es_url = "".join([es_host, es_endpoint])
        logger.info("Sending data to %s: %s", es_url, self.body)
        headers = {'Content-Type': 'text/plain', 'Connection': 'close'}
        r = requests.post(es_url, data=json.dumps(self.body), headers=headers)
        r.raise_for_status()


class BugzillaBugRequest(object):

    def __init__(self, project, job_id, bug_id):
        self.project = project
        self.job_id = job_id
        self.bug_id = bug_id
        self.body = ""

    def generate_request_body(self):
        """
        Create a comment describing the failure, that will be posted to Bugzilla.
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
            'log': "{0}/logviewer.html#?repo={1}&job_id={2}".format(
                settings.SITE_URL,
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
            "comment": body_comment
        }

    def send_request(self):
        """
        Post the bug comment to Bugzilla's REST API.
        """
        if not self.body:
            self.generate_request_body()
        bz_comment_endpoint = "/rest/bug/%s/comment" % self.bug_id
        api_url = "".join([settings.BZ_API_URL, bz_comment_endpoint])
        credentials = {'login': settings.TBPLBOT_EMAIL, 'password': settings.TBPLBOT_PASSWORD}
        headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        logger.info("Sending data to %s: %s", api_url, self.body)
        r = requests.post(api_url, params=credentials, data=json.dumps(self.body), headers=headers)
        r.raise_for_status()
