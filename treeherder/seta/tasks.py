from treeherder.seta.analyze_failures import AnalyzeFailures
from treeherder.workers.task import retryable_task


@retryable_task(name='seta-analyze-failures', max_retries=3, time_limit=5*60)
def seta_analyze_failures():
    '''We analyze all starred test failures from the last four months which were fixed by a commit.'''
    AnalyzeFailures().run()
