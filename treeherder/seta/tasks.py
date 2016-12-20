from cerely import task
from treeherder.seta.analyze_failures import AnalyzeFailures
from treeherder.seta.preseed import load_preseed


@task(name='seta-analyze-failures', time_limit=20*60)
def seta_analyze_failures():
    '''We analyze the starred test failures of the last 90 days which were fixed by a commit.'''
    AnalyzeFailures().run()


@task(name='seta-load-preseed', time_limit=5*60)
def seta_load_preseed():
    '''We load JobPriority from preseed.json'''
    load_preseed()
