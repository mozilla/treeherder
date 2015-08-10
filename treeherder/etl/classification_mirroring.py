import logging
from datetime import datetime

import requests
import simplejson as json
from django.conf import settings

from treeherder.model.derived import ArtifactsModel, JobsModel

logger = logging.getLogger(__name__)


class ElasticsearchDocRequest(object):

    def __init__(self, project, job_id, bug_id, classification_timestamp, who):
        self.project = project
        self.job_id = job_id
        self.bug_id = bug_id
        self.classification_timestamp = classification_timestamp
        self.who = who
        self.body = {}

    def generate_request_body(self):
        """
        Create the data structure that will be sent to Elasticsearch.
        """
        with JobsModel(self.project) as jobs_model, ArtifactsModel(self.project) as artifacts_model:
            job_data = jobs_model.get_job(self.job_id)[0]
            option_collection = jobs_model.refdata_model.get_all_option_collections()
            revision_list = jobs_model.get_resultset_revisions_list(job_data["result_set_id"])
            buildapi_artifact = artifacts_model.get_job_artifact_list(0, 1, {
                'job_id': set([("=", self.job_id)]),
                'name': set([("=", "buildapi")])
            })
            if buildapi_artifact:
                buildname = buildapi_artifact[0]["blob"]["buildername"]
            else:
                # OrangeFactor needs a buildname to be set or it skips the failure
                # classification, so we make one up for non-buildbot jobs.
                buildname = 'non-buildbot %s test %s' % (job_data["platform"], job_data["job_type_name"])

        self.body = {
            "buildname": buildname,
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
            "timestamp": str(self.classification_timestamp),
            "treeherder_job_id": self.job_id,
        }

    def send_request(self):
        """
        Send request to Elasticsearch.
        """
        es_host = settings.ES_HOST
        es_endpoint = "/bugs/bug_info/"
        es_url = "".join([es_host, es_endpoint])
        logger.info("Sending data to %s: %s", es_url, self.body)
        headers = {'Content-Type': 'text/plain', 'Connection': 'close'}
        r = requests.post(es_url, data=json.dumps(self.body), headers=headers, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
        try:
            r.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.error("HTTPError %s submitting to %s: %s", r.status_code, es_url, r.text)
            raise


class BugzillaCommentRequest(object):

    def __init__(self, project, job_id, bug_id, who):
        self.project = project
        self.job_id = job_id
        self.bug_id = bug_id
        self.who = who
        self.body = ""

    def generate_request_body(self):
        """
        Create a comment describing the failure, that will be posted to Bugzilla.
        This is triggered by a new bug-job association.
        """
        with JobsModel(self.project) as jobs_model, ArtifactsModel(self.project) as artifacts_model:
            job = jobs_model.get_job(self.job_id)[0]
            failures_artifacts = artifacts_model.get_job_artifact_list(0, 1, {
                'job_id': set([('=', job['id'])]),
                'name': set([('=', 'Bug suggestions')]),
            })
            error_lines = []
            for artifact in failures_artifacts:
                # a bug suggestion aritfact looks like this:
                # [{ "search": "my-error-line", "search_terms": [], "bugs": ....}]
                error_lines += [line["search"] for line in artifact["blob"]]

            revision_list = jobs_model.get_resultset_revisions_list(
                job["result_set_id"]
            )

            buildapi_info = artifacts_model.get_job_artifact_list(0, 1, {
                'job_id': set([("=", self.job_id)]),
                'name': set([("=", "buildapi")])
            })

        who = self.who \
            .replace("@", "[at]")\
            .replace(".", "[dot]")
        start_time = datetime.fromtimestamp(job["start_timestamp"]).isoformat()

        job_description = {
            'repository': self.project,
            'who': who,
            'start_time': start_time,
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
        else:
            # make up a buildername for taskcluster jobs
            job_description['buildname'] = 'non-buildbot %s test %s' % (job["platform"], job["job_type_name"])

        body_comment = '\n'.join(
            ["{0}: {1}".format(k, v) for k, v in job_description.items()])

        body_comment += '\n\n'
        body_comment += '\n'.join(error_lines)

        # Truncate the comment to ensure it is not rejected for exceeding the max
        # Bugzilla comment length and to reduce the amount of spam in bugs. We should
        # rarely hit this given the number of error lines are capped during ingestion.
        if len(body_comment) > settings.BZ_MAX_COMMENT_LENGTH:
            body_comment = body_comment[:settings.BZ_MAX_COMMENT_LENGTH - 3] + '...'

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
        r = requests.post(api_url, params=credentials, data=json.dumps(self.body), headers=headers, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
        try:
            r.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.error("HTTPError %s submitting to %s: %s", r.status_code, api_url, r.text)
            raise
