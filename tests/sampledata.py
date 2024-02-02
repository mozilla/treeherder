import json
import os


class SampleData:
    @classmethod
    def get_perf_data(cls, filename):
        with open(f"{os.path.dirname(__file__)}/sample_data/artifacts/performance/{filename}") as f:
            return json.load(f)

    def __init__(self):
        self.job_data_file = f"{os.path.dirname(__file__)}/sample_data/job_data.txt"

        self.push_data_file = f"{os.path.dirname(__file__)}/sample_data/push_data.json"

        self.logs_dir = f"{os.path.dirname(__file__)}/sample_data/logs"

        with open(f"{os.path.dirname(__file__)}/sample_data/artifacts/text_log_summary.json") as f:
            self.text_log_summary = json.load(f)

        with open(
            "{0}/sample_data/pulse_consumer/taskcluster_pulse_messages.json".format(
                os.path.dirname(__file__)
            )
        ) as f:
            self.taskcluster_pulse_messages = json.load(f)

        with open(
            f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/taskcluster_tasks.json"
        ) as f:
            self.taskcluster_tasks = json.load(f)

        with open(
            "{0}/sample_data/pulse_consumer/taskcluster_transformed_jobs.json".format(
                os.path.dirname(__file__)
            )
        ) as f:
            self.taskcluster_transformed_jobs = json.load(f)

        with open(f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/job_data.json") as f:
            self.pulse_jobs = json.load(f)

        with open(
            f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/transformed_job_data.json"
        ) as f:
            self.transformed_pulse_jobs = json.load(f)

        with open(f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/github_push.json") as f:
            self.github_push = json.load(f)

        with open(
            f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/transformed_gh_push.json"
        ) as f:
            self.transformed_github_push = json.load(f)

        with open(f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/github_pr.json") as f:
            self.github_pr = json.load(f)

        with open(
            f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/transformed_gh_pr.json"
        ) as f:
            self.transformed_github_pr = json.load(f)

        with open(f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/hg_push.json") as f:
            self.hg_push = json.load(f)

        with open(
            f"{os.path.dirname(__file__)}/sample_data/pulse_consumer/transformed_hg_push.json"
        ) as f:
            self.transformed_hg_push = json.load(f)

        self.job_data = []
        self.push_data = []

        self.initialize_data()

    def initialize_data(self):
        with open(self.job_data_file) as f:
            for line in f.readlines():
                self.job_data.append(json.loads(line.strip()))

        with open(self.push_data_file) as f:
            self.push_data = json.load(f)

    def get_log_path(self, name):
        """Returns the full path to a log file"""
        return f"{self.logs_dir}/{name}"
