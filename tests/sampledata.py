import json
import os
from django.conf import settings


class SampleData(object):

    @classmethod
    def get_credentials(cls):

        credentials = {
            'test_treeherder': {
                'consumer_key':'8de17836-4a9b-45f5-824c-5ada76713334',
                'consumer_secret':'0f71d011-d773-4831-9f1c-17b237207467'
                }
            }

        return credentials

    def __init__(self):

        self.job_data_file = "{0}/sample_data/job_data.txt".format(
            os.path.dirname(__file__)
        )

        self.resultset_data_file = "{0}/sample_data/resultset_data.json".format(
            os.path.dirname(__file__)
        )

        self.raw_pulse_data_file = "{0}/sample_data/raw_pulse_data.txt".format(
            os.path.dirname(__file__)
        )
        self.logs_dir = "{0}/sample_data/logs".format(
            os.path.dirname(__file__)
        )

        with open("{0}/sample_data/artifacts/structured_log_artifact.json".format(
                  os.path.dirname(__file__))) as f:
            self.structured_log_artifact = f.readlines()

        with open("{0}/sample_data/artifacts/job_artifact.json".format(
                  os.path.dirname(__file__))) as f:
            self.job_artifact = f.readlines()

        self.job_data = []
        self.raw_pulse_data = []
        self.resultset_data = []

        self.initialize_data()

    def initialize_data(self):

        with open(self.job_data_file) as f:
            for line in f.readlines():
                self.job_data.append(json.loads(line.strip()))

        with open(self.resultset_data_file) as f:

            self.resultset_data = json.loads(f.read())

            # ensure that the repository values for all the revisions have the
            # same name as the db test name in settings.  If this is not
            # the same, the tests will not pass.
            for rs in self.resultset_data:
                for rev in rs["revisions"]:
                    rev["repository"] = settings.DATABASES["default"]["TEST_NAME"]

        with open(self.raw_pulse_data_file) as f:
            for line in f.readlines():
                line = str(line)
                self.raw_pulse_data.append(json.loads(line.strip()))

    def get_log_path(self, name):
        """Returns the full path to a log file"""
        return "{0}/{1}".format(self.logs_dir, name)

