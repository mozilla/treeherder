from celery import task

from treeherder.intermittents_commenter.commenter import Commenter


@task(name='intermittents-commenter')
def run_commenter(weekly_mode=False):
    """
    Run the intermittents commenter in either daily or weekly mode.
    """
    process = Commenter(weekly_mode=weekly_mode)
    process.run()
