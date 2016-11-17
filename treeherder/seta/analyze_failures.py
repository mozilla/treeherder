import datetime
import json
import logging
import os

import requests
from redo import retry

from treeherder.seta.models import JobPriority
from treeherder.seta.seta import get_high_value_jobs
from treeherder.seta.update_job_priority import ManageJobPriorityTable


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
            # This is because we can't run this command without the table containing
            # all jobs first; See increase_job_priority() function about the root issue
            ManageJobPriorityTable().update_job_priority_table()
            high_value_jobs = get_high_value_jobs(revisions_fixed_by_commit_plus_tagged_jobs,
                                                  self.analysis_percentage,
                                                  self.ignore_failures)

            if not self.dry_run:
                self.clear_expiration_field_for_expired_jobs()
                self.increase_jobs_priority(high_value_jobs)

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
        try:
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
        except Exception as error:
            # XXX: Should we not simply abort the script?
            # we will return an empty 'failures' list if got exception here
            LOG.warning("The request for %s failed due to %s" % (url, error))
            LOG.warning("We will work with an empty list of failures")
            data = {'failures': []}

        LOG.info("start-date: {}, end-date: {}, failures: {}".format(
             self.start_date, self.end_date, len(data['failures'])))
        return data['failures']

    def clear_expiration_field_for_expired_jobs(self):
        # Only select rows where there is an expiration date set
        data = JobPriority.objects.filter(expiration_date__isnull=False)

        for job in data:
            if job.has_expired():
                LOG.info('Clearing expiration date for {}'.format(job))
                job.expiration_date = None
                job.save()

    def increase_jobs_priority(self, high_value_jobs, priority=1, timeout=0):
        """For every high value job  see if we need to adjust the priority in the database

        Currently, high value jobs have a priority of 1 and a timeout of 0.

        Return how many jobs had their priority increased
        """
        LOG.info("Let's see if we need to increase the priority of any job")
        # NOTE: We ignore job priorities with expiration date set
        original_queryset = JobPriority.objects.filter(expiration_date__isnull=True)
        new_jobs = []
        changed_jobs = []
        for item in high_value_jobs:
            # This is a query of a unique composite index, thus, a list of zero or one
            queryset = original_queryset.filter(testtype=item[2], buildtype=item[1], platform=item[0])
            assert len(queryset) in (0, 1)

            if not queryset:
                # XXX: If we knew the build system type we could insert it in the DB
                # If we run update_job_priority we're likely not to encounter new jobs
                LOG.warning("We can't insert this high value job: {}".format(item))
                continue
            else:
                job = queryset[0]

            if job.priority != priority:
                job.priority = priority
                job.timeout = timeout
                job.save()
                changed_jobs.append(item)

        LOG.info("Inserted {} new jobs; Updated {} jobs; Analyzed {} jobs".format(
            len(new_jobs), len(changed_jobs), len(high_value_jobs)))

        return changed_jobs
