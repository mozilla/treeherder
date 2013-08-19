import json
import os


class SampleData(object):

    def __init__(self):

        self.job_data_file = "{0}/sample_data/job_data.txt".format(
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

        self.initialize_data()

    def initialize_data(self):

        with open(self.job_data_file) as f:
            for line in f.readlines():
                self.job_data.append(json.loads(line.strip()))

        with open(self.raw_pulse_data_file) as f:
            for line in f.readlines():
                line = str(line)
                self.raw_pulse_data.append(json.loads(line.strip()))

    def get_log_path(self, name):
        """Returns the full path to a log file"""
        return "{0}/{1}".format(self.logs_dir, name)