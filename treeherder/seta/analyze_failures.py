import logging

from treeherder.etl.seta import parse_testtype
from treeherder.model import models
from treeherder.seta.common import unique_key
from treeherder.seta.high_value_jobs import get_high_value_jobs
from treeherder.seta.models import JobPriority
from treeherder.seta.update_job_priority import update_job_priority_table

HEADERS = {
    'Accept': 'application/json',
    'User-Agent': 'treeherder-seta',
}
logger = logging.getLogger(__name__)


class AnalyzeFailures:
    def __init__(self, **options):
        self.dry_run = options['dry_run']

    def run(self):
        fixed_by_commit_jobs = get_failures_fixed_by_commit()
        if fixed_by_commit_jobs:
            # We need to update the job priority table before we can call get_high_value_jobs()
            # See increase_job_priority() to understand the root issue
            update_job_priority_table()
            high_value_jobs = get_high_value_jobs(fixed_by_commit_jobs)

            if not self.dry_run:
                logger.info("Let's see if we need to increase the priority of any job")
                JobPriority.objects.clear_expiration_field_for_expired_jobs()
                JobPriority.objects.increase_jobs_priority(high_value_jobs)


def get_failures_fixed_by_commit():
    """ Return all job failures annotated with "fixed by commit" grouped by reason given for annotation.

        It returns a dictionary with a revision or bug ID as the key (bug ID is used for
        intermittent failures and the revision is used for real failures). For SETA's purposes
        we only care about revisions (real failures).
        The failures for *real failures* will contain all jobs that have been starred as "fixed by commit".

        Notice that the data does not tell you on which repository a root failure was fixed.

        For instance, in the raw data you might see a reference to 9fa614d8310d which is a back out
        and it is reference by 12 starred jobs:
            https://treeherder.mozilla.org/#/jobs?repo=autoland&filter-searchStr=android%20debug%20cpp&tochange=9fa614d8310db9aabe85cc3c3cff6281fe1edb0c
        The raw data will show those 12 jobs.

        The returned data will look like this:
        {
          "failures": {
            "44d29bac3654": [
              ["android-4-0-armv7-api15", "opt", "android-lint"],
              ["android-4-0-armv7-api15", "opt", "android-api-15-gradle-dependencies"],
            ]
          }
        }
    """
    failures = {}
    # We're assuming that sheriffs always anotate failed jobs correctly using "fixed by commit"
    for job_note in models.JobNote.objects.filter(failure_classification=2):
        # This prevents the empty string case and ignores bug ids
        if not job_note.text or len(job_note.text) < 12:
            continue

        # We currently don't guarantee that text is actually a revision
        # Even if not perfect the main idea is that a bunch of jobs were annotated with
        # a unique identifier. The assumption is that the text is unique
        #
        # I've seen these values being used:
        #  * 12 char revision
        #  * 40 char revision
        #  * link to revision on hg
        #  * revisionA & revisionB
        #  * should be fixed by <revision>
        #  * bug id
        #
        # Note that if some jobs are annotated with the 12char revision and others with the
        # 40char revision we will have two disjunct set of failures
        #
        # Some of this will be improved in https://bugzilla.mozilla.org/show_bug.cgi?id=1323536
        if job_note.text not in failures:
            failures[job_note.text] = []

        try:
            testtype = parse_testtype(
                build_system_type=job_note.job.signature.build_system_type,  # e.g. taskcluster
                job_type_name=job_note.job.job_type.name,  # e.g. Mochitest
                platform_option=job_note.job.get_platform_option(),  # e.g. 'opt'
                ref_data_name=job_note.job.signature.name,  # buildername or task label
            )
            failures[job_note.text].append(unique_key(
                testtype=testtype,
                buildtype=job_note.job.get_platform_option(),  # e.g. 'opt'
                platform=job_note.job.signature.build_platform
            ))
        except models.Job.DoesNotExist:
            logger.warning('job_note {} has no job associated to it'.format(job_note.id))
            continue

    logger.info("failures: {}".format(len(failures)))
    return failures
