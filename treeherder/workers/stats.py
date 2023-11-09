from celery import shared_task


@shared_task(name='publish-stats')
def publish_stats():
    """
    Publish runtime stats on statsd
    """
    print('Publishing stats')
    raise NotImplementedError
