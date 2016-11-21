import logging

from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     Job,
                                     Matcher)

from .autoclassify import (AUTOCLASSIFY_CUTOFF_RATIO,
                           match_errors)

logger = logging.getLogger(__name__)


def detect(test_job):
    with JobsModel(test_job.repository.name) as jm:
        ds_jobs = jm.get_job_repeats(test_job.guid)
        jobs_by_guid = {item["job_guid"]: item for item in ds_jobs}
        jobs = Job.objects.filter(repository=test_job.repository,
                                  guid__in=jobs_by_guid.keys())
        assert len(jobs) == len(ds_jobs)
        for item in jobs:
            guid = item.guid
            jobs_by_guid[guid] = (item, jobs_by_guid[guid])
        jobs = jobs_by_guid.values()

    # The approach here is currently to look for new intermittents to add, one at a time
    # and then rerun the matching on other jobs
    # TODO: limit the possible matches to those that have just been added
    if len(jobs) <= 1:
        logger.debug("Too few jobs in the current set")
        return

    # For now conservatively assume that we can only mark new intermittents if
    # one run in the current set fully passes
    if not any(ds_job["result"] == "success" for _, ds_job in jobs):
        logger.debug("No successful jobs to compare against")
        return

    failures_by_job = FailureLine.objects.for_jobs(*(job for job, _ in jobs))

    for job, ds_job in jobs:
        logger.info("Looking for new intermittents from job %s" % (job.guid,))
        job_failures = failures_by_job.get(job.guid)
        if job_failures is None:
            logger.debug("Job has no failures")
            continue

        new_matches = {}

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
                    failure_line.save(update_fields=['best_classification'])
                    if failure_line.error:
                        failure_line.error.best_classification = classification
                        failure_line.error.save(update_fields=['best_classification'])
            for job, ds_job in jobs:
                if job == test_job:
                    continue
                logger.debug("Trying rematch on job %s" % (job.guid))
                match_errors(job)
