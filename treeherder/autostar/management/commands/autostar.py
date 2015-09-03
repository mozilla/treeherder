import logging

from django.core.management.base import BaseCommand, CommandError

from treeherder.autostar import matchers
from treeherder.model.models import FailureLine, Matcher

logger = logging.getLogger(__name__)

# The minimum goodness of match we need to mark a particular match as the best match
AUTOSTAR_CUTOFF_RATIO = 0.8

# Initialisation needed to associate matcher functions with the matcher objects
matchers.register()


class Command(BaseCommand):
    args = '<job_guid>, <repository>'
    help = 'Mark failures on a job.'

    def handle(self, *args, **options):

        if not len(args) == 2:
            raise CommandError('3 arguments required, %s given' % len(args))
        job_id, repository = args

        match_errors(repository, job_id)


def match_errors(repository, job_guid):
    unmatched_failures = FailureLine.objects.unmatched_for_job(repository, job_guid)

    if not unmatched_failures:
        return

    all_matched = set()

    for matcher in Matcher.objects.auto_matchers():
        matches = matcher(unmatched_failures)
        for failure, intermittent, score in matches:
            logger.info("Matched failure %i with intermittent %i" % (failure.id,
                                                                     intermittent.id))
            failure.add_match(matcher.db_object, intermittent, score)
            all_matched.add(failure)
        if all_lines_matched(unmatched_failures):
            break

    for failure in all_matched:
        # TODO: store all matches
        best_match = failure.best_match(AUTOSTAR_CUTOFF_RATIO)
        if best_match:
            best_match.is_best = True
            best_match.save()


def all_lines_matched(job_failures):
    if any(not failure_line.matches.all() or
           all(match.score < 1 for match in failure_line.matches.all())
           for failure_line in job_failures):
        return False
    return True
