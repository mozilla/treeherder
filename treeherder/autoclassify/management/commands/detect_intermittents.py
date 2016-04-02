import logging

from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     Matcher)

from .autoclassify import (AUTOCLASSIFY_CUTOFF_RATIO,
                           match_errors)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    args = '<repository>, <job_guid>'
    help = 'Look for new intermittents in a job'

    def handle(self, *args, **options):
        if not len(args) == 2:
            raise CommandError('2 arguments required, %s given' % len(args))
        repository, job_guid = args

        with JobsModel(repository) as jm:
            jobs = jm.get_job_repeats(job_guid)
            add_new_intermittents(repository, jm, jobs)


def add_new_intermittents(repository, jm, jobs):
    # The approach here is currently to look for new intermittents to add, one at a time
    # and then rerun the matching on other jobs
    # TODO: limit the possible matches to those that have just been added
    if len(jobs) <= 1:
        logger.debug("Too few jobs in the current set")
        return

    # For now conservatively assume that we can only mark new intermittents if
    # one run in the current set fully passes
    if not any(job["result"] == "success" for job in jobs):
        logger.debug("No successful jobs to compare against")
        return

    failures_by_job = FailureLine.objects.for_jobs(*jobs)

    for job in jobs:
        logger.info("Looking for new intermittents from job %s" % (job["job_guid"]))
        if not job["job_guid"] in failures_by_job:
            logger.debug("Job has no failures")
            continue

        new_matches = {}

        job_failures = failures_by_job[job["job_guid"]]

        unmatched_lines = [item for item in job_failures if
                           not item.classified_failures.count()]

        for detector in Matcher.objects.registered_detectors():

            unmatched_lines = [item for item in unmatched_lines if item.id not in new_matches]

            if unmatched_lines:
                logger.debug("Found %i unmatched lines" % len(unmatched_lines))
            detected_indicies = detector(unmatched_lines)

            for index in detected_indicies:
                failure = unmatched_lines[index]
                classification, failure_match = failure.set_classification(detector.db_object)
                new_matches[failure.id] = (classification, failure_match)

        if new_matches:
            failure_lines = [item for item in job_failures if item.id in new_matches]
            for failure_line in failure_lines:
                classification, failure_match = new_matches[failure_line.id]
                if failure_match.score > AUTOCLASSIFY_CUTOFF_RATIO:
                    failure_line.best_classification = classification
                    failure_line.save()
            for rematch_job in jobs:
                if rematch_job == job:
                    continue
                logger.debug("Trying rematch on job %s" % (rematch_job["job_guid"]))
                match_errors(repository, jm, rematch_job["job_guid"])
