import logging
import time

import requests
from django.conf import settings
from requests_hawk import HawkAuth

from treeherder.etl.common import make_request
from treeherder.model.models import (Job,
                                     OptionCollection)

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
        job = Job.objects.get(id=self.job_id)
        buildtype = " ".join(sorted(OptionCollection.objects.values_list(
            'option__name', flat=True).filter(
                option_collection_hash=job.option_collection_hash)))
        revision = job.push.revision
        ref_data_name = job.signature.name

        self.body = {
            "buildname": ref_data_name,
            "machinename": job.machine.name,
            "os": job.machine_platform.platform,
            # I'm using the request time date here, as start time is not
            # available for pending jobs
            "date": job.submit_time.strftime("%Y-%m-%d"),
            "type": job.job_type.name,
            "buildtype": buildtype,
            # Intentionally using strings for starttime, bug, timestamp for compatibility
            # with TBPL's legacy output format.
            "starttime": str(int(time.mktime(job.start_time.timetuple()))),
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
