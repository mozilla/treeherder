import json
import os

from django.conf import settings


class SampleData(object):

    @classmethod
    def get_perf_data(cls, filename):
        with open("{0}/sample_data/artifacts/performance/{1}".format(
                os.path.dirname(__file__), filename)) as f:
            return json.loads(f.read())

    @classmethod
    def get_talos_perf_data(cls):
        return cls.get_perf_data('talos_perf.json')

    @classmethod
    def get_minimal_talos_perf_data(cls):
        return cls.get_perf_data('talos_perf_minimal.json')

    def __init__(self):
        self.job_data_file = "{0}/sample_data/job_data.txt".format(
            os.path.dirname(__file__)
        )

        self.resultset_data_file = "{0}/sample_data/resultset_data.json".format(
            os.path.dirname(__file__)
        )

        self.logs_dir = "{0}/sample_data/logs".format(
            os.path.dirname(__file__)
        )

        self.talos_logs_dir = "{0}/sample_data/artifacts/performance/talos_logs".format(
            os.path.dirname(__file__)
        )

        with open("{0}/sample_data/artifacts/structured_log_artifact.json".format(
                  os.path.dirname(__file__))) as f:
            self.structured_log_artifact = f.readlines()

        with open("{0}/sample_data/artifacts/job_artifact.json".format(
                  os.path.dirname(__file__))) as f:
            self.job_artifact = f.readlines()

        with open("{0}/sample_data/artifacts/text_log_summary.json".format(
                  os.path.dirname(__file__))) as f:
            self.text_log_summary = json.load(f)

        with open("{0}/sample_data/pulse_consumer/job_data.json".format(
                  os.path.dirname(__file__))) as f:
            self.pulse_jobs = json.load(f)

        self.job_data = []
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
                    rev["repository"] = settings.TREEHERDER_TEST_PROJECT

    def get_log_path(self, name):
        """Returns the full path to a log file"""
        return "{0}/{1}".format(self.logs_dir, name)

    def get_talos_logs(self):
        """Returns a list of full paths to talos log files"""
        files = os.listdir(self.talos_logs_dir)
        for i, f in enumerate(files):
            files[i] = 'file://{0}/{1}'.format(self.talos_logs_dir, f)
        return files
