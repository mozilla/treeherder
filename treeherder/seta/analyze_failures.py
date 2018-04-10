import logging
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from treeherder.etl.seta import (is_job_blacklisted,
                                 parse_testtype)
from treeherder.model import models
from treeherder.seta.common import unique_key
from treeherder.seta.high_value_jobs import get_high_value_jobs
from treeherder.seta.models import JobPriority
from treeherder.seta.settings import (SETA_FIXED_BY_COMMIT_DAYS,
                                      SETA_FIXED_BY_COMMIT_REPOS,
                                      SETA_SUPPORTED_TC_JOBTYPES,
                                      SETA_UNSUPPORTED_PLATFORMS)
from treeherder.seta.update_job_priority import update_job_priority_table

logger = logging.getLogger(__name__)


class AnalyzeFailures(object):
    def __init__(self, **options):
        self.dry_run = options.get('dry_run', False)

    def run(self):
        fixed_by_commit_jobs = get_failures_fixed_by_commit()
        if fixed_by_commit_jobs:
            # We need to update the job priority table before we can call get_high_value_jobs()
            update_job_priority_table()
            high_value_jobs = get_high_value_jobs(fixed_by_commit_jobs)

            if not self.dry_run:
                logger.warning("Let's see if we need to increase the priority of any job")
                JobPriority.objects.clear_expiration_field_for_expired_jobs()
                JobPriority.objects.adjust_jobs_priority(high_value_jobs)


def get_failures_fixed_by_commit():
    """ Return all job failures annotated with "fixed by commit" grouped by reason given for annotation.

        It returns a dictionary with a revision or bug ID as the key (bug ID is used for
        intermittent failures and the revision is used for real failures). For SETA's purposes
        we only care about revisions (real failures).
        The failures for *real failures* will contain all jobs that have been starred as "fixed by commit".

        Notice that the data does not tell you on which repository a root failure was fixed.

        For instance, in the raw data you might see a reference to 9fa614d8310d which is a back out
        and it is referenced by 12 starred jobs:
            https://treeherder.mozilla.org/#/jobs?repo=autoland&filter-searchStr=android%20debug%20cpp&tochange=9fa614d8310db9aabe85cc3c3cff6281fe1edb0c
        The raw data will show those 12 jobs.

        The returned data will look like this:
        {
           "44d29bac3654": [
              ["android-4-0-armv7-api15", "opt", "android-lint"],
              ["android-4-0-armv7-api15", "opt", "android-api-15-gradle-dependencies"],
            ]
        }
    """
    failures = defaultdict(list)
    option_collection_map = models.OptionCollection.objects.get_option_collection_map()

    fixed_by_commit_data_set = models.JobNote.objects.filter(
            failure_classification=2,
            created__gt=timezone.now() - timedelta(days=SETA_FIXED_BY_COMMIT_DAYS),
            text__isnull=False,
            job__repository__name__in=SETA_FIXED_BY_COMMIT_REPOS
        ).exclude(
            job__signature__build_platform__in=SETA_UNSUPPORTED_PLATFORMS
        ).exclude(
            text=""
        ).select_related('job', 'job__signature', 'job__job_type')

    # check if at least one fixed by commit job meets our requirements without populating queryset
    if not fixed_by_commit_data_set.exists():
        logger.warning("We couldn't find any fixed-by-commit jobs")
        return failures

    # now process the fixed by commit jobs in batches using django's queryset iterator
    for job_note in fixed_by_commit_data_set.iterator():
        # if we have http://hg.mozilla.org/rev/<rev> and <rev>, we will only use <rev>
        revision_id = job_note.text.strip('/')
        revision_id = revision_id.split('/')[-1]

        # This prevents the empty string case and ignores bug ids
        if not revision_id or len(revision_id) < 12:
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

        try:
            # check if jobtype is supported by SETA (see treeherder/seta/settings.py)
            if job_note.job.signature.build_system_type != 'buildbot':
                if not job_note.job.job_type.name.startswith(tuple(SETA_SUPPORTED_TC_JOBTYPES)):
                    continue

            testtype = parse_testtype(
                build_system_type=job_note.job.signature.build_system_type,  # e.g. taskcluster
                job_type_name=job_note.job.job_type.name,  # e.g. Mochitest
                platform_option=job_note.job.get_platform_option(option_collection_map),  # e.g. 'opt'
                ref_data_name=job_note.job.signature.name,  # buildername or task label
            )

            if testtype:
                if is_job_blacklisted(testtype):
                    continue
            else:
                logger.warning('We were unable to parse %s/%s',
                               job_note.job.job_type.name, job_note.job.signature.name)
                continue

            # we now have a legit fixed-by-commit job failure
            failures[revision_id].append(unique_key(
                testtype=testtype,
                buildtype=job_note.job.get_platform_option(option_collection_map),  # e.g. 'opt'
                platform=job_note.job.signature.build_platform
            ))
        except models.Job.DoesNotExist:
            logger.warning('job_note %s has no job associated to it', job_note.id)
            continue

    logger.warning("Number of fixed_by_commit revisions: %s", len(failures))
    return failures
