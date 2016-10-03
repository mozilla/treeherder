from celery import task

from treeherder.seta.analyze_failures import AnalyzeFailures
from treeherder.seta.preseed import load_preseed
from treeherder.workers.task import retryable_task


@retryable_task(name='seta-analyze-failures', max_retries=3, time_limit=5*60)
def seta_analyze_failures():
    '''We analyze all starred test failures from the last four months which were fixed by a commit.'''
    AnalyzeFailures().run()


@task(name='seta-load-preseed', max_retries=3, time_limit=1*60)
def seta_load_preseed():
    '''We load JobPriority from preseed.json'''
    load_preseed()
