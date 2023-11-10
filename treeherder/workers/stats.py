from celery import shared_task
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging
from django.db.models import Count
from treeherder.model.models import Push, Job, Repository
from itertools import groupby

logging.basicConfig()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

EXPECTED_TC_STATES = (
    'pending',
    'unscheduled',
    'runnable',
    'running',
    'fail',
    'completed',
    'retry',
    'exception',
    'unknown',
)
EXPECTED_REPOSITORIES = Repository.objects.values_list('name', flat=True)


@shared_task(name='publish-stats')
def publish_stats():
    """
    Publish runtime stats on statsd
    """
    logger.info('Publishing runtime statistics to statsd')
    end_date = timezone.now()
    # Round the date to the current date range
    # This should not overlapse as the beat is set as a relative cron based delay in minutes
    end_date = end_date - timedelta(
        minutes=end_date.minute - end_date.minute % settings.CELERY_STATS_PUBLICATION_DELAY,
        seconds=end_date.second,
        microseconds=end_date.microsecond,
    )

    start_date = end_date - timedelta(minutes=settings.CELERY_STATS_PUBLICATION_DELAY)
    logger.debug(f'Reading data ingested from {start_date} to {end_date}')

    # Nb of pushes
    pushes_count = Push.objects.filter(time__lte=end_date, time__gt=start_date).count()
    logger.info(f'Ingested {pushes_count} pushes')
    # Compute stats for jobs in a single request
    jobs_stats = (
        Job.objects.filter(
            end_time__lte=end_date, end_time__gt=start_date, state__in=EXPECTED_TC_STATES
        )
        .values('push__repository__name', 'state')
        .annotate(count=Count('id'))
        .values_list('push__repository__name', 'state', 'count')
    )
    # nb of job total
    jobs_total = sum(ct for _, _, ct in jobs_stats)
    logger.info(f'Ingested {jobs_total} jobs in total')
    # nb of job per repo
    jobs_per_repo = {repo_name: 0 for repo_name in EXPECTED_REPOSITORIES}
    jobs_per_repo.update(
        {
            key: sum(ct for k, ct in vals)
            for key, vals in groupby(
                sorted((repo, ct) for repo, _, ct in jobs_stats), lambda x: x[0]
            )
        }
    )
    logger.debug(f'Jobs per repo: {jobs_per_repo}')

    # nb of job per state
    jobs_per_state = {state: 0 for state in EXPECTED_TC_STATES}
    jobs_per_state.update(
        {
            key: sum(ct for k, ct in vals)
            for key, vals in groupby(
                sorted((state, ct) for _, state, ct in jobs_stats), lambda x: x[0]
            )
        }
    )
    logger.debug(f'Jobs per state : {jobs_per_state}')
