import datetime
import json
import logging
import os

import requests
from redo import retry

from treeherder.seta.models import JobPriority
from treeherder.seta.seta import get_high_value_jobs
from treeherder.seta.update_job_priority import update_job_priority_table

LOG = logging.getLogger(__name__)
DAYS_TO_ANALYZE = 90  # Number of days to go back and gather failures


class AnalyzeFailures:
    def __init__(self, **options):
        self.start_date = (datetime.datetime.now() -
                           datetime.timedelta(days=DAYS_TO_ANALYZE)).strftime("%Y-%m-%d")
        self.end_date = datetime.datetime.now().strftime("%Y-%m-%d")
        self.analysis_percentage = 100  # 100% detection
        self.seta_host = os.environ.get('SETA_HOST', 'http://alertmanager.allizom.org')

        self.ignore_failures = options['ignore_failures']
        self.dry_run = options['dry_run']
        if options['start_date']:
            self.start_date = datetime.datetime.strptime(options['start_date'],
                                                         "%Y-%m-%d").strftime("%Y-%m-%d")
        if options['end_date']:
            self.end_date = datetime.datetime.strptime(options['end_date'],
                                                       "%Y-%m-%d").strftime("%Y-%m-%d")

    def run(self):
        revisions_fixed_by_commit_plus_tagged_jobs = self.get_raw_data()
        if revisions_fixed_by_commit_plus_tagged_jobs:
            # We need to update the job priority table before we can call get_high_value_jobs()
            # See increase_job_priority() to understand the root issue
            update_job_priority_table()
            high_value_jobs = get_high_value_jobs(revisions_fixed_by_commit_plus_tagged_jobs,
                                                  self.analysis_percentage,
                                                  self.ignore_failures)

            if not self.dry_run:
                LOG.info("Let's see if we need to increase the priority of any job")
                JobPriority.objects.clear_expiration_field_for_expired_jobs()
                JobPriority.objects.increase_jobs_priority(high_value_jobs)

    def get_raw_data(self):
        """Reach the data/seta endpoint for all failures that have been marked as "fixed by commit"

        The endpoint returns a dictionary with a key per revision or bug ID (the bug ID is used for
        intermittent failures and the revision is used for real failures). The failures for *real
        failures* will contain all jobs that have been starred as "fixed by commit".

        Notice that the raw data does not tell you on which repository a root failure was fixed.

        For instance, in the raw data you might see a reference to 9fa614d8310d which is a back out
        and it is reference by 12 starred jobs:
            https://treeherder.mozilla.org/#/jobs?repo=autoland&filter-searchStr=android%20debug%20cpp&tochange=9fa614d8310db9aabe85cc3c3cff6281fe1edb0c
        The raw data will show those 12 jobs.

        We return the obtained data or an empty structure if we failed to fetch it.

        [1]
        {
          "failures": {
            "44d29bac3654": [
              ["android-4-0-armv7-api15", "opt", "android-lint", 2804 ],
              ["android-4-0-armv7-api15", "opt", "android-api-15-gradle-dependencies", 2801],
        """
        # XXX: Once this uses data from Treeherder we will be able to query the table directly
        url = self.seta_host + "/data/seta/?startDate=%s&endDate=%s" % (
            self.start_date, self.end_date)
        LOG.info('Grabbing information from {}'.format(url))
        response = retry(requests.get,
                         args=(url, ),
                         kwargs={
                             'headers': {
                                 'Accept': 'application/json',
                                 'User-Agent': 'treeherder',
                             },
                             'verify': True
                         })
        data = json.loads(response.content)

        LOG.info("start-date: {}, end-date: {}, failures: {}".format(
             self.start_date, self.end_date, len(data['failures'])))
        return data['failures']
