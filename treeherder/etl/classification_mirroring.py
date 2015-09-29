import logging
from datetime import datetime

import requests
import simplejson as json
from django.conf import settings

from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)

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
            "date": datetime.utcfromtimestamp(job_data["submit_timestamp"]).strftime("%Y-%m-%d"),
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
