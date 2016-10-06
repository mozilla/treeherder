import logging
from datetime import datetime

import requests
from django.conf import settings
from requests_hawk import HawkAuth

from treeherder.etl.common import make_request
from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)
from treeherder.model.models import (OptionCollection,
                                     Push)

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
            buildtype = " ".join(sorted(OptionCollection.objects.values_list(
                'option__name', flat=True).filter(
                    option_collection_hash=job_data["option_collection_hash"])))
            revision = Push.objects.values_list(
                'revision', flat=True).get(id=job_data['push_id'])
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
            "buildtype": buildtype,
            # Intentionally using strings for starttime, bug, timestamp for compatibility
            # with TBPL's legacy output format.
            "starttime": str(job_data["start_timestamp"]),
            "tree": self.project,
            "rev": revision,
            "bug": str(self.bug_id),
            "who": self.who,
            "timestamp": str(self.classification_timestamp),
            "treeherder_job_id": self.job_id,
        }

    def send_request(self):
        """
        Submit classification report to Elasticsearch, via OrangeFactor's API.
        """
        url = settings.ORANGEFACTOR_SUBMISSION_URL
        auth = HawkAuth(id=settings.ORANGEFACTOR_HAWK_ID, key=settings.ORANGEFACTOR_HAWK_KEY)
        logger.info("Submitting %s job %s's classification of bug %s to OrangeFactor", self.project, self.job_id, self.bug_id)
        try:
            make_request(url, method='POST', json=self.body, auth=auth)
        except requests.exceptions.HTTPError as e:
            r = e.response
            logger.error("HTTPError %s submitting to %s: %s", r.status_code, url, r.text)
            raise
